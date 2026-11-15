import { z } from 'zod';

export const WALLET_PANELS = ['history', 'deposits', 'withdrawals', 'achievements', 'deposit', 'withdraw'] as const;
export type WalletPanel = (typeof WALLET_PANELS)[number];

export const solanaAddressSchema = z.string().trim().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

export const withdrawalSchema = z.object({
  destinationAddress: solanaAddressSchema,
  amount: z.number().finite().min(0.01).max(1_000_000_000).refine((value) => Math.round(value * 100) === value * 100),
});
