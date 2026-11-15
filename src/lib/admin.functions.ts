import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database, Json } from '@/integrations/supabase/types';
import {
  achievementSchema, balanceAdjustmentSchema, gameSettingsSchema, kycReviewSchema,
  missionTermsSchema, playerDetailsSchema, playerListSchema, reportRangeSchema,
  telegramRelinkSchema, userBlockSchema, withdrawalListSchema, withdrawalReviewSchema,
  type StaffRole,
} from './admin-rules';

const ALL_STAFF: StaffRole[] = ['admin', 'finance', 'support'];
const FINANCE: StaffRole[] = ['admin', 'finance'];
const KYC_STAFF: StaffRole[] = ['admin', 'support'];
const ADMIN: StaffRole[] = ['admin'];
type Client = SupabaseClient<Database>;
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type LedgerRow = Database['public']['Tables']['ledger']['Row'];
type WithdrawalRow = Database['public']['Tables']['withdrawals']['Row'];

function throwDb(error: { message: string } | null): never {
  throw new Error(error?.message || 'DATABASE_ERROR');
}
async function requireRoles(supabase: Client, userId: string, aal: unknown, allowed: StaffRole[]) {
  void aal;
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  if (error) throwDb(error);
  const roles = (data ?? []).map((row) => row.role) as StaffRole[];
  if (!roles.some((role) => allowed.includes(role))) throw new Error('FORBIDDEN');
  return roles;
}

export const getAdminAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
  if (error) throwDb(error);
  const roles = (data ?? []).map((row) => row.role) as StaffRole[];
  return {
    staff: roles.length > 0,
    roles,
    aal: context.claims.aal === 'aal2' ? 'aal2' : 'aal1',
    email: typeof context.claims.email === 'string' ? context.claims.email : '',
  };
});

export const getAdminOverview = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const roles = await requireRoles(context.supabase, context.userId, context.claims.aal, ALL_STAFF);
  const [players, pendingKyc, recentBets] = await Promise.all([
    context.supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
    context.supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('status', 'pending').not('kyc_submitted_at', 'is', null),
    context.supabase.from('bets').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);
  if (players.error) throwDb(players.error);
  if (pendingKyc.error) throwDb(pendingKyc.error);
  if (recentBets.error) throwDb(recentBets.error);
  let requestedWithdrawals: number | null = null;
  if (roles.some((role) => FINANCE.includes(role))) {
    const result = await context.supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'requested');
    if (result.error) throwDb(result.error);
    requestedWithdrawals = result.count ?? 0;
  }
  return { players: players.count ?? 0, pendingKyc: pendingKyc.count ?? 0, requestedWithdrawals, bets24h: recentBets.count ?? 0 };
});

export const listAdminPlayers = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => playerListSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, ALL_STAFF);
    let query = context.supabase.from('profiles').select('user_id,email,full_name,status,created_at,telegram_id,telegram_relink_allowed,solana_wallet_address,rejection_reason', { count: 'exact' });
    if (data.search) query = query.or(`email.ilike.%${data.search}%,full_name.ilike.%${data.search}%`);
    if (data.status !== 'all') query = query.eq('status', data.status);
    const from = (data.page - 1) * data.pageSize;
    const { data: rows, error, count } = await query.order('created_at', { ascending: false }).range(from, from + data.pageSize - 1);
    if (error) throwDb(error);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getKycQueue = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireRoles(context.supabase, context.userId, context.claims.aal, KYC_STAFF);
  const { data, error } = await context.supabase.from('profiles').select('user_id,email,full_name,nationality,kyc_submitted_at,created_at').eq('status', 'pending').not('kyc_submitted_at', 'is', null).order('kyc_submitted_at', { ascending: true });
  if (error) throwDb(error);
  return data ?? [];
});

export const getKycDetails = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, KYC_STAFF);
    const [{ data: profile, error: profileError }, { data: files, error: filesError }] = await Promise.all([
      context.supabase.from('profiles').select('*').eq('user_id', data.userId).single(),
      context.supabase.from('kyc_files').select('*').eq('user_id', data.userId).order('created_at', { ascending: false }),
    ]);
    if (profileError) throwDb(profileError);
    if (filesError) throwDb(filesError);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const documents = await Promise.all((files ?? []).map(async (file) => {
      const { data: signed, error } = await supabaseAdmin.storage.from('kyc').createSignedUrl(file.storage_path, 300);
      if (error || !signed) throwDb(error);
      return { ...file, signedUrl: signed.signedUrl, expiresIn: 300 };
    }));
    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
      actor_id: context.userId, action: 'kyc_documents_viewed', target_table: 'profiles', target_id: data.userId,
      details: { file_count: documents.length },
    });
    if (auditError) throwDb(auditError);
    return { profile, documents };
  });

export const reviewKyc = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => kycReviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, KYC_STAFF);
    const { error } = await context.supabase.rpc('admin_review_kyc', {
      _user_id: data.userId, _decision: data.decision,
      ...(data.reason ? { _reason: data.reason } : {}), ...(data.wallet ? { _wallet: data.wallet } : {}),
    });
    if (error) throwDb(error);
    return { ok: true };
  });

export const getAdminPlayer = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => playerDetailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const roles = await requireRoles(context.supabase, context.userId, context.claims.aal, ALL_STAFF);
    const { data: profile, error: profileError } = await context.supabase.from('profiles').select('*').eq('user_id', data.userId).single();
    if (profileError) throwDb(profileError);
    let betsQuery = context.supabase.from('bets').select('id,game,amount,payout,result,created_at,balance_before,balance_after', { count: 'exact' }).eq('user_id', data.userId);
    if (data.game) betsQuery = betsQuery.eq('game', data.game);
    if (data.outcome === 'win') betsQuery = betsQuery.gt('payout', 0);
    if (data.outcome === 'loss') betsQuery = betsQuery.eq('payout', 0);
    const betFrom = (data.betPage - 1) * 20;
    const { data: bets, error: betsError, count: betTotal } = await betsQuery.order('created_at', { ascending: false }).range(betFrom, betFrom + 19);
    if (betsError) throwDb(betsError);
    const canManageMoney = roles.some((role) => FINANCE.includes(role));
    let balance: number | null = null;
    let deposits: LedgerRow[] = [];
    let withdrawals: WithdrawalRow[] = [];
    if (canManageMoney) {
      const { data: value, error } = await context.supabase.rpc('get_balance', { _user_id: data.userId });
      if (error) throwDb(error);
      balance = Number(value ?? 0);
      const [depositResult, withdrawalResult] = await Promise.all([
        context.supabase.from('ledger').select('*').eq('user_id', data.userId).eq('type', 'deposit').order('created_at', { ascending: false }).limit(50),
        context.supabase.from('withdrawals').select('*').eq('user_id', data.userId).order('created_at', { ascending: false }).limit(50),
      ]);
      if (depositResult.error) throwDb(depositResult.error);
      if (withdrawalResult.error) throwDb(withdrawalResult.error);
      deposits = depositResult.data ?? [];
      withdrawals = withdrawalResult.data ?? [];
    }
    const [{ data: achievements, error: achievementsError }, { data: referrals, error: referralsError }] = await Promise.all([
      context.supabase.from('user_achievements').select('id,unlocked_at,achievement:achievements(code,title_en,title_ru,reward_amount,icon)').eq('user_id', data.userId).order('unlocked_at', { ascending: false }),
      context.supabase.from('referrals').select('*').or(`referrer_id.eq.${data.userId},referred_id.eq.${data.userId}`).order('created_at', { ascending: false }),
    ]);
    if (achievementsError) throwDb(achievementsError);
    if (referralsError) throwDb(referralsError);
    const relatedIds = [...new Set((referrals ?? []).flatMap((row) => [row.referrer_id, row.referred_id]))];
    let relatedProfiles: Pick<ProfileRow, 'user_id' | 'email' | 'full_name'>[] = [];
    if (relatedIds.length) {
      const { data: related, error } = await context.supabase.from('profiles').select('user_id,email,full_name').in('user_id', relatedIds);
      if (error) throwDb(error);
      relatedProfiles = related ?? [];
    }
    return {
      profile, balance, deposits, withdrawals, achievements: achievements ?? [], referrals: referrals ?? [], relatedProfiles,
      bets: bets ?? [], betTotal: betTotal ?? 0, betPage: data.betPage, betPageSize: 20, canManageMoney,
    };
  });

export const adjustPlayerBalance = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => balanceAdjustmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, FINANCE);
    const { data: id, error } = await context.supabase.rpc('admin_adjust_balance', {
      _user_id: data.userId, _kind: data.kind, _amount: data.amount, _reason: data.reason,
      ...(data.txHash ? { _tx_hash: data.txHash } : {}),
    });
    if (error) throwDb(error);
    return { ok: true, ledgerId: id };
  });

export const listAdminWithdrawals = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => withdrawalListSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, FINANCE);
    let query = context.supabase.from('withdrawals').select('*', { count: 'exact' });
    if (data.status !== 'all') query = query.eq('status', data.status);
    const from = (data.page - 1) * 20;
    const { data: rows, error, count } = await query.order('created_at', { ascending: true }).range(from, from + 19);
    if (error) throwDb(error);
    const ids = [...new Set((rows ?? []).map((row) => row.user_id))];
    let players: Pick<ProfileRow, 'user_id' | 'email' | 'full_name'>[] = [];
    if (ids.length) {
      const { data: profiles, error: profilesError } = await context.supabase.from('profiles').select('user_id,email,full_name').in('user_id', ids);
      if (profilesError) throwDb(profilesError);
      players = profiles ?? [];
    }
    return { rows: (rows ?? []).map((row) => ({ ...row, player: players.find((player) => player.user_id === row.user_id) ?? null })), total: count ?? 0, page: data.page, pageSize: 20 };
  });

export const reviewWithdrawal = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => withdrawalReviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, FINANCE);
    const { error } = await context.supabase.rpc('admin_review_withdrawal', {
      _withdrawal_id: data.withdrawalId, _decision: data.decision,
      ...(data.reason ? { _reason: data.reason } : {}), ...(data.txHash ? { _tx_hash: data.txHash } : {}),
    });
    if (error) throwDb(error);
    return { ok: true };
  });

export const setUserBlocked = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => userBlockSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, ADMIN);
    const { error } = await context.supabase.rpc('admin_set_user_blocked', { _user_id: data.userId, _blocked: data.blocked, _reason: data.reason });
    if (error) throwDb(error);
    return { ok: true };
  });

export const allowTelegramRelink = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => telegramRelinkSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, KYC_STAFF);
    const { error } = await context.supabase.rpc('admin_allow_telegram_relink', { _user_id: data.userId, _allowed: data.allowed });
    if (error) throwDb(error);
    return { ok: true };
  });

export const getAdminSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireRoles(context.supabase, context.userId, context.claims.aal, ADMIN);
  const [games, terms, achievements] = await Promise.all([
    context.supabase.from('game_settings').select('*').order('game'),
    context.supabase.from('app_settings').select('*').eq('key', 'mission_terms').maybeSingle(),
    context.supabase.from('achievements').select('*').order('created_at', { ascending: false }),
  ]);
  if (games.error) throwDb(games.error);
  if (terms.error) throwDb(terms.error);
  if (achievements.error) throwDb(achievements.error);
  return { games: games.data ?? [], missionTerms: terms.data?.value ?? null, achievements: achievements.data ?? [] };
});

export const saveGameSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => gameSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, ADMIN);
    const { error } = await context.supabase.rpc('admin_save_game_settings', { _game: data.game, _rtp: data.rtp, _min_bet: data.minBet, _max_bet: data.maxBet, _enabled: data.enabled });
    if (error) throwDb(error);
    return { ok: true };
  });

export const saveMissionTerms = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => missionTermsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, ADMIN);
    const { error } = await context.supabase.rpc('admin_save_cashback_terms', {
      _version: data.version, _rollover: data.rollover, _expires_days: data.expiresDays,
      _terms: data.terms, _withdrawal_rules: data.withdrawalRules,
    });
    if (error) throwDb(error);
    return { ok: true };
  });

export const saveAchievement = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => achievementSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, ADMIN);
    const { data: id, error } = await context.supabase.rpc('admin_save_achievement', {
      _id: data.id ?? '00000000-0000-0000-0000-000000000000', _code: data.code, _title_en: data.titleEn, _title_ru: data.titleRu,
      _description_en: data.descriptionEn, _description_ru: data.descriptionRu,
      _icon: data.icon, _reward_amount: data.rewardAmount, _criteria: data.criteria as Json, _active: data.active,
    });
    if (error) throwDb(error);
    return { ok: true, id };
  });

export type AdminReport = {
  revenue: number; deposits: number; withdrawals: number; bet_volume: number; active_players: number;
  games: Array<{ game: string; volume: number; bets: number }>;
};
export const getAdminReports = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => reportRangeSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminReport> => {
    await requireRoles(context.supabase, context.userId, context.claims.aal, FINANCE);
    const { data: report, error } = await context.supabase.rpc('admin_reports', { _from: data.from, _to: data.to });
    if (error) throwDb(error);
    return report as unknown as AdminReport;
  });

export const getAdminAudit = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireRoles(context.supabase, context.userId, context.claims.aal, ADMIN);
  const { data, error } = await context.supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throwDb(error);
  return data ?? [];
});
