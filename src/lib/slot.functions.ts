import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database, Json } from '@/integrations/supabase/types';
import { generateSlotRounds, prepareSpinSchema, randomServerSeed, sha256Hex, spinSchema, type SlotRound } from './slot-engine';

const hasServiceKey = () => Boolean(process.env['SUPABASE_SERVICE_ROLE_KEY']);

// Without the service key (e.g. external hosting) we fall back to the player's own
// authenticated client and a demo session: reels spin, but no money moves, because
// letting a browser-authenticated client write outcomes or ledger rows would let it mint balance.
async function privileged(fallback: SupabaseClient<Database>): Promise<SupabaseClient<Database>> {
  if (!hasServiceKey()) return fallback;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

const DEFAULT_SETTINGS = { game: '', rtp: 96, enabled: true, min_bet: 0.1, max_bet: 100 };

function throwDb(error: { message: string } | null): never {
  throw new Error(error?.message || 'DATABASE_ERROR');
}

async function checkSlotAccess(supabase: SupabaseClient<Database>, userId: string, game: string) {
  const [profile, excluded] = await Promise.all([
    supabase.from('profiles').select('status').eq('user_id', userId).maybeSingle(),
    supabase.rpc('is_self_excluded', { _user_id: userId }),
  ]);
  if (profile.error) throwDb(profile.error);
  if (!profile.data || profile.data.status !== 'approved') throw new Error('PLAYER_NOT_APPROVED');
  // Game settings (incl. RTP) are staff-only via RLS; read them server-side after the caller is verified.
  if (excluded.error) throwDb(excluded.error);
  if (excluded.data) throw new Error('SELF_EXCLUDED');
  if (!hasServiceKey()) return { ...DEFAULT_SETTINGS, game };
  const db = await privileged(supabase);
  const settings = await db.from('game_settings').select('game,rtp,enabled,min_bet,max_bet').eq('game', game).maybeSingle();
  if (settings.error) throwDb(settings.error);
  if (!settings.data || !settings.data.enabled) throw new Error('GAME_DISABLED');
  return settings.data;
}

export const prepareSpin = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => prepareSpinSchema.parse(input))
  .handler(async ({ data, context }) => {
    const settings = await checkSlotAccess(context.supabase, context.userId, data.game);
    const serverSeed = randomServerSeed();
    const serverSeedHash = await sha256Hex(serverSeed);
    const demo = () => ({ sessionId: `demo_${serverSeed}`, game: data.game, serverSeedHash, clientSeed: data.clientSeed, nonce: 0, rtp: Number(settings.rtp) });
    if (!hasServiceKey()) return demo();
    const supabaseAdmin = await privileged(context.supabase);
    const { data: session, error } = await supabaseAdmin.from('slot_sessions').insert({
      user_id: context.userId,
      game: data.game,
      server_seed: serverSeed,
      server_seed_hash: serverSeedHash,
      client_seed: data.clientSeed,
    }).select('id,nonce,created_at').single();
    if (error || !session) { console.error('[slot] session insert failed, using demo session', error?.message); return demo(); }
    return { sessionId: session.id, game: data.game, serverSeedHash, clientSeed: data.clientSeed, nonce: Number(session.nonce), rtp: Number(settings.rtp) };
  });

type SpinResponse = { rounds: SlotRound[]; balance: number };

export const spin = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => spinSchema.parse(input))
  .handler(async ({ data, context }): Promise<SpinResponse> => {
    if (data.sessionId.startsWith('demo_')) {
      const settings = await checkSlotAccess(context.supabase, context.userId, data.game);
      const startNonce = parseInt((await sha256Hex(data.requestId)).slice(0, 8), 16);
      const rounds = await generateSlotRounds({ serverSeed: data.sessionId.slice(5), clientSeed: 'demo', startNonce, bet: data.bet, spins: data.spins, rtp: Number(settings.rtp) });
      const { data: wallet } = await context.supabase.rpc('get_balance', { _user_id: context.userId });
      return { rounds, balance: Number(wallet ?? 0) };
    }
    const supabaseAdmin = await privileged(context.supabase);
    const { data: previous, error: previousError } = await supabaseAdmin.from('spin_requests').select('response')
      .eq('request_id', data.requestId).eq('session_id', data.sessionId).eq('user_id', context.userId).maybeSingle();
    if (previousError) throwDb(previousError);
    if (previous) return previous.response as unknown as SpinResponse;
    const settings = await checkSlotAccess(context.supabase, context.userId, data.game);
    const { data: session, error: sessionError } = await supabaseAdmin.from('slot_sessions').select('*').eq('id', data.sessionId).maybeSingle();
    if (sessionError) throwDb(sessionError);
    if (!session || session.user_id !== context.userId) throw new Error('SPIN_SESSION_NOT_FOUND');
    if (session.status !== 'active') throw new Error('SPIN_SESSION_REVEALED');
    if (session.game !== data.game) throw new Error('GAME_MISMATCH');
    if (data.bet < Number(settings.min_bet) || data.bet > Number(settings.max_bet)) throw new Error('INVALID_BET');

    const rounds = await generateSlotRounds({
      serverSeed: session.server_seed,
      clientSeed: session.client_seed,
      startNonce: Number(session.nonce),
      bet: data.bet,
      spins: data.spins,
      rtp: Number(settings.rtp),
    });
    const publicResponse: SpinResponse = { rounds, balance: 0 };
    const { data: response, error } = await supabaseAdmin.rpc('play_slot_spins', {
      _session_id: data.sessionId,
      _request_id: data.requestId,
      _bet: data.bet,
      _spins: data.spins,
      _results: rounds as unknown as Json,
      _response: publicResponse as unknown as Json,
    });
    if (error) throwDb(error);
    return response as unknown as SpinResponse;
  });

export const revealSpinSession = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sessionId: z.union([z.string().uuid(), z.string().regex(/^demo_[a-f0-9]{64}$/)]) }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.sessionId.startsWith('demo_')) {
      const serverSeed = data.sessionId.slice(5);
      return { sessionId: data.sessionId, serverSeed, serverSeedHash: await sha256Hex(serverSeed), clientSeed: 'demo', nonce: 0 };
    }
    const supabaseAdmin = await privileged(context.supabase);
    const { data: session, error } = await supabaseAdmin.from('slot_sessions').select('id,user_id,status,server_seed,server_seed_hash,client_seed,nonce')
      .eq('id', data.sessionId).maybeSingle();
    if (error) throwDb(error);
    if (!session || session.user_id !== context.userId) throw new Error('SPIN_SESSION_NOT_FOUND');
    if (session.status === 'active') {
      const { error: updateError } = await supabaseAdmin.from('slot_sessions').update({ status: 'revealed', revealed_at: new Date().toISOString() }).eq('id', session.id).eq('status', 'active');
      if (updateError) throwDb(updateError);
    }
    return {
      sessionId: session.id,
      serverSeed: session.server_seed,
      serverSeedHash: session.server_seed_hash,
      clientSeed: session.client_seed,
      nonce: Number(session.nonce),
    };
  });
