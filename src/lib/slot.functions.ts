import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database, Json } from '@/integrations/supabase/types';
import { generateSlotRounds, prepareSpinSchema, randomServerSeed, sha256Hex, spinSchema, type SlotRound } from './slot-engine';

function throwDb(error: { message: string } | null): never {
  throw new Error(error?.message || 'DATABASE_ERROR');
}

async function checkSlotAccess(supabase: SupabaseClient<Database>, userId: string, game: string) {
  const [profile, excluded, settings] = await Promise.all([
    supabase.from('profiles').select('status').eq('user_id', userId).maybeSingle(),
    supabase.rpc('is_self_excluded', { _user_id: userId }),
    supabase.from('game_settings').select('game,rtp,enabled,min_bet,max_bet').eq('game', game).maybeSingle(),
  ]);
  if (profile.error) throwDb(profile.error);
  if (excluded.error) throwDb(excluded.error);
  if (settings.error) throwDb(settings.error);
  if (!profile.data || profile.data.status !== 'approved') throw new Error('PLAYER_NOT_APPROVED');
  if (excluded.data) throw new Error('SELF_EXCLUDED');
  if (!settings.data || !settings.data.enabled) throw new Error('GAME_DISABLED');
  return settings.data;
}

export const prepareSpin = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => prepareSpinSchema.parse(input))
  .handler(async ({ data, context }) => {
    const settings = await checkSlotAccess(context.supabase, context.userId, data.game);
    const serverSeed = randomServerSeed();
    const serverSeedHash = await sha256Hex(serverSeed);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: session, error } = await supabaseAdmin.from('slot_sessions').insert({
      user_id: context.userId,
      game: data.game,
      server_seed: serverSeed,
      server_seed_hash: serverSeedHash,
      client_seed: data.clientSeed,
    }).select('id,nonce,created_at').single();
    if (error) throwDb(error);
    return { sessionId: session.id, game: data.game, serverSeedHash, clientSeed: data.clientSeed, nonce: Number(session.nonce), rtp: Number(settings.rtp) };
  });

type SpinResponse = { rounds: SlotRound[]; balance: number };

export const spin = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => spinSchema.parse(input))
  .handler(async ({ data, context }): Promise<SpinResponse> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
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
  .inputValidator((input) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
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
