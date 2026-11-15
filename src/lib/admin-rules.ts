import { z } from 'zod';
import { cashbackTermsSchema } from './cashback-rules';

export const STAFF_ROLES = ['admin', 'finance', 'support'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const ROLE_LABELS: Record<StaffRole, string> = { admin: 'Admin', finance: 'Financeiro', support: 'Suporte' };
export const SOLANA_WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const SOLANA_TX_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const uuid = z.string().uuid();
const reason = z.string().trim().min(3).max(1000);
const search = z.string().trim().max(100).regex(/^[\p{L}\p{N}@._\-\s]*$/u, 'INVALID_SEARCH');

export const playerListSchema = z.object({
  search: search.default(''),
  status: z.enum(['all', 'pending', 'approved', 'rejected', 'blocked']).default('all'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(50).default(20),
});
export const kycReviewSchema = z.object({
  userId: uuid,
  decision: z.enum(['approve', 'reject']),
  wallet: z.string().trim().regex(SOLANA_WALLET_PATTERN).optional().or(z.literal('')),
  reason: z.string().trim().max(1000).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.decision === 'approve' && !value.wallet) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'INVALID_SOLANA_WALLET' });
  if (value.decision === 'reject' && (!value.reason || value.reason.length < 3)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'REASON_REQUIRED' });
});
export const balanceAdjustmentSchema = z.object({
  userId: uuid,
  kind: z.enum(['deposit', 'adjustment']),
  amount: z.number().finite().min(-1_000_000_000).max(1_000_000_000).refine((value) => value !== 0),
  reason,
  txHash: z.string().trim().max(200).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.kind === 'deposit' && value.amount <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'DEPOSIT_MUST_BE_POSITIVE' });
  if (value.kind === 'adjustment' && value.txHash) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'TX_HASH_ONLY_FOR_DEPOSIT' });
});
export const referralCodeApprovalSchema = z.object({
  userId: uuid,
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, 'INVALID_REFERRAL_CODE').optional().or(z.literal('')),
});
export const playerDetailsSchema = z.object({
  userId: uuid,
  betPage: z.number().int().min(1).default(1),
  game: z.string().trim().max(40).regex(/^[a-zA-Z0-9_-]*$/).default(''),
  outcome: z.enum(['all', 'win', 'loss']).default('all'),
});
export const withdrawalReviewSchema = z.object({
  withdrawalId: uuid,
  decision: z.enum(['approve', 'reject', 'pay']),
  reason: z.string().trim().max(1000).optional().or(z.literal('')),
  txHash: z.string().trim().optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.decision === 'reject' && (!value.reason || value.reason.length < 3)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'REASON_REQUIRED' });
  if (value.decision === 'pay' && (!value.txHash || !SOLANA_TX_PATTERN.test(value.txHash))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'VALID_TX_HASH_REQUIRED' });
});
export const userBlockSchema = z.object({ userId: uuid, blocked: z.boolean(), reason });
export const telegramRelinkSchema = z.object({ userId: uuid, allowed: z.boolean() });
export const gameSettingsSchema = z.object({
  game: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/),
  rtp: z.number().finite().positive().max(100),
  minBet: z.number().finite().positive().max(1_000_000_000),
  maxBet: z.number().finite().positive().max(1_000_000_000),
  enabled: z.boolean(),
}).refine((value) => value.maxBet >= value.minBet, { message: 'INVALID_GAME_SETTINGS' });
export const missionTermsSchema = cashbackTermsSchema;
export const achievementSchema = z.object({
  id: uuid.nullable(),
  code: z.string().trim().regex(/^[a-z0-9_-]{2,50}$/),
  titleEn: z.string().trim().min(2).max(120),
  titleRu: z.string().trim().min(2).max(120),
  descriptionEn: z.string().trim().max(1000),
  descriptionRu: z.string().trim().max(1000),
  icon: z.string().trim().max(40),
  rewardAmount: z.number().finite().min(0).max(1_000_000_000),
  criteria: z.record(z.unknown()),
  active: z.boolean(),
});
export const reportRangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() }).refine((value) => new Date(value.from) < new Date(value.to));
export const withdrawalListSchema = z.object({
  status: z.enum(['all', 'requested', 'approved', 'paid', 'rejected']).default('all'),
  page: z.number().int().min(1).default(1),
});

const ERROR_MESSAGES: Record<string, string> = {
  MFA_REQUIRED: 'Confirme o segundo fator para continuar.',
  FORBIDDEN: 'Seu papel não permite esta ação.',
  REASON_REQUIRED: 'Informe um motivo com pelo menos 3 caracteres.',
  INVALID_SOLANA_WALLET: 'Informe um endereço Solana válido.',
  VALID_TX_HASH_REQUIRED: 'Informe uma assinatura de transação Solana válida.',
  TX_HASH_ONLY_FOR_DEPOSIT: 'O hash só deve ser informado em créditos de depósito.',
  DEPOSIT_MUST_BE_POSITIVE: 'O depósito deve ter valor positivo.',
  INVALID_AMOUNT: 'Informe um valor válido.',
  INVALID_REFERRAL_CODE: 'Use um código de 8 letras ou números, ou deixe vazio para gerar automaticamente.',
  PROFILE_NOT_FOUND: 'Jogador não encontrado.',
  KYC_NOT_PENDING: 'Este KYC já foi analisado ou ainda não foi enviado.',
  INVALID_WITHDRAWAL_STATUS: 'O saque mudou de status. Atualize a lista.',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente para esta operação.',
};
export function adminErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/profiles_referral_code_key/i.test(message)) return 'Este código de indicação já está em uso.';
  if (/duplicate key|ledger_tx_hash_unique|withdrawals_tx_hash_unique/i.test(message)) return 'Esta transação já foi utilizada.';
  if (/Insufficient balance/i.test(message)) return ERROR_MESSAGES['INSUFFICIENT_BALANCE']!;
  const code = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
  return (code ? ERROR_MESSAGES[code] : undefined) ?? message ?? 'Não foi possível concluir a ação.';
}
