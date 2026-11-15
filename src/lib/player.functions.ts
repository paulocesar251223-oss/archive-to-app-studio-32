import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { depositLimitsSchema, exclusionSchema, canPlay } from './player-rules';

export const getPlayerSafety = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [limits, exclusions] = await Promise.all([
    context.supabase.from('deposit_limits').select('period,amount,effective_from,created_at').eq('user_id', context.userId).lte('effective_from', new Date().toISOString()).order('effective_from', { ascending: false }).order('created_at', { ascending: false }),
    context.supabase.rpc('is_self_excluded', { _user_id: context.userId }),
  ]);
  if (limits.error || exclusions.error) throw new Error(limits.error?.message ?? exclusions.error?.message);
  const values: Record<string, number> = {};
  for (const row of limits.data ?? []) if (values[row.period] === undefined) values[row.period] = Number(row.amount);
  return { limits: values, excluded: Boolean(exclusions.data) };
});

export const saveDepositLimits = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input) => depositLimitsSchema.parse(input)).handler(async ({ data, context }) => {
  const { data: profile, error } = await context.supabase.from('profiles').select('status').eq('user_id', context.userId).maybeSingle();
  if (error || !profile || profile.status !== 'approved') throw new Error('PLAYER_NOT_APPROVED');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.rpc('player_save_limits', { _user_id: context.userId, _daily: data.daily, _weekly: data.weekly, _monthly: data.monthly });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const selfExclude = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input) => exclusionSchema.parse(input)).handler(async ({ data, context }) => {
  const { data: profile, error } = await context.supabase.from('profiles').select('status').eq('user_id', context.userId).maybeSingle();
  if (error || !profile || profile.status !== 'approved') throw new Error('PLAYER_NOT_APPROVED');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.rpc('player_self_exclude', { _user_id: context.userId, _days: data.days as number });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const checkGameAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [profile, excluded] = await Promise.all([context.supabase.from('profiles').select('status').eq('user_id', context.userId).maybeSingle(), context.supabase.rpc('is_self_excluded', { _user_id: context.userId })]);
  if (profile.error || excluded.error || !profile.data || !canPlay(profile.data.status, Boolean(excluded.data))) throw new Error('PLAY_NOT_ALLOWED');
  return { ok: true };
});