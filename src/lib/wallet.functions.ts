import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withdrawalSchema } from './wallet-rules';

function throwDb(error: { message: string } | null): never {
  throw new Error(error?.message || 'DATABASE_ERROR');
}

export const getWallet = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [profile, balance, ledger, withdrawals, unlocked, catalog, excluded, mission, settings, referrals] = await Promise.all([
    context.supabase.from('profiles').select('full_name,email,referral_code,referral_code_status,referral_requested_at,solana_wallet_address').eq('user_id', context.userId).maybeSingle(),
    context.supabase.rpc('get_balance', { _user_id: context.userId }),
    context.supabase.from('ledger').select('id,type,amount,reason,tx_hash,created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(100),
    context.supabase.from('withdrawals').select('id,amount,destination_address,status,tx_hash,rejection_reason,created_at,updated_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(100),
    context.supabase.from('user_achievements').select('achievement_id,unlocked_at').eq('user_id', context.userId),
    context.supabase.from('achievements').select('id,code,title_en,title_ru,description_en,description_ru,reward_amount,icon').eq('active', true).order('created_at'),
    context.supabase.rpc('is_self_excluded', { _user_id: context.userId }),
    context.supabase.from('missions').select('id,total_amount,status,terms_version,created_at,deposit_amount,rollover,expires_at,installments:mission_installments(sequence,amount,due_at,status,paid_at)').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    context.supabase.from('app_settings').select('value').eq('key', 'mission_terms').maybeSingle(),
    context.supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', context.userId),
  ]);
  if (profile.error) throwDb(profile.error);
  if (!profile.data) throw new Error('PROFILE_NOT_FOUND');
  if (balance.error) throwDb(balance.error);
  if (ledger.error) throwDb(ledger.error);
  if (withdrawals.error) throwDb(withdrawals.error);
  if (unlocked.error) throwDb(unlocked.error);
  if (catalog.error) throwDb(catalog.error);
  if (excluded.error) throwDb(excluded.error);
  if (mission.error) throwDb(mission.error);
  if (settings.error) throwDb(settings.error);
  if (referrals.error) throwDb(referrals.error);

  const unlockedById = new Map((unlocked.data ?? []).map((item) => [item.achievement_id, item.unlocked_at]));
  const rawTerms = settings.data?.value && typeof settings.data.value === 'object' && !Array.isArray(settings.data.value)
    ? settings.data.value as Record<string, unknown>
    : {};
  const installments = (mission.data?.installments ?? []).map((item) => ({
    sequence: item.sequence,
    amount: Number(item.amount),
    dueAt: item.due_at,
    status: item.status,
    paidAt: item.paid_at,
  })).sort((a, b) => a.sequence - b.sequence);

  return {
    profile: {
      ...profile.data,
      referral_code: profile.data.referral_code_status === 'approved' ? profile.data.referral_code : null,
      referral_code_status: profile.data.referral_code_status as 'not_requested' | 'pending' | 'approved',
    },
    balance: Number(balance.data ?? 0),
    ledger: ledger.data ?? [],
    withdrawals: withdrawals.data ?? [],
    achievements: (catalog.data ?? []).map((item) => ({
      id: item.id,
      code: item.code,
      unlockedAt: unlockedById.get(item.id) ?? null,
      titleEn: item.title_en,
      titleRu: item.title_ru,
      descriptionEn: item.description_en ?? '',
      descriptionRu: item.description_ru ?? '',
      rewardAmount: Number(item.reward_amount),
      icon: item.icon ?? 'trophy',
    })),
    excluded: Boolean(excluded.data),
    mission: mission.data ? {
      id: mission.data.id,
      totalAmount: Number(mission.data.total_amount),
      status: mission.data.status,
      termsVersion: mission.data.terms_version,
      depositAmount: Number(mission.data.deposit_amount ?? 0),
      rollover: Number(mission.data.rollover),
      expiresAt: mission.data.expires_at,
      installments,
    } : null,
    missionTerms: {
      version: typeof rawTerms['version'] === 'number' ? rawTerms['version'] : 1,
      rollover: typeof rawTerms['rollover'] === 'number' ? rawTerms['rollover'] : 1,
      expiresDays: typeof rawTerms['expiresDays'] === 'number' ? rawTerms['expiresDays'] : 30,
      terms: typeof rawTerms['terms'] === 'string' ? rawTerms['terms'] : '',
      withdrawalRules: typeof rawTerms['withdrawalRules'] === 'string' ? rawTerms['withdrawalRules'] : '',
    },
    referralCount: referrals.count ?? 0,
  };
});

export const requestReferralCode = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: status, error } = await context.supabase.rpc('request_referral_code');
  if (error) throwDb(error);
  return { status };
});

export const getReferralLink = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: profile, error } = await context.supabase.from('profiles').select('referral_code,referral_code_status').eq('user_id', context.userId).maybeSingle();
  if (error) throwDb(error);
  if (!profile) throw new Error('PROFILE_NOT_FOUND');
  if (profile.referral_code_status !== 'approved') throw new Error('REFERRAL_CODE_PENDING');
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) throw new Error('TELEGRAM_BOT_UNAVAILABLE');
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10_000) });
  const result: unknown = await response.json();
  const username = result && typeof result === 'object' && 'result' in result
    && result.result && typeof result.result === 'object' && 'username' in result.result
    ? result.result.username
    : null;
  if (!response.ok || typeof username !== 'string' || !/^[a-zA-Z0-9_]{5,64}$/.test(username)) {
    throw new Error('TELEGRAM_BOT_UNAVAILABLE');
  }
  return { url: `https://t.me/${username}?start=${profile.referral_code}`, code: profile.referral_code };
});

export const requestWithdrawal = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => withdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc('request_withdrawal', {
      _amount: data.amount,
      _destination_address: data.destinationAddress,
    });
    if (error) throwDb(error);
    return { ok: true, id };
  });
