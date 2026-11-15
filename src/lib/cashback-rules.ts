import { z } from 'zod';

export const CASHBACK_MAX_DEPOSIT = 200;
export const CASHBACK_TOTAL = 100;
export const CASHBACK_INSTALLMENTS = 5;
export const CASHBACK_INSTALLMENT_AMOUNT = 20;

export type CashbackInstallment = {
  sequence: number;
  amount: number;
  dueAt: string;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt: string | null;
};

export const cashbackTermsSchema = z.object({
  version: z.number().int().min(1).max(1_000_000),
  rollover: z.number().finite().min(0).max(1000),
  expiresDays: z.number().int().min(1).max(365),
  terms: z.string().trim().min(10).max(20_000),
  withdrawalRules: z.string().trim().min(3).max(5000),
});

export function isCashbackEligibleDeposit(amount: number) {
  return Number.isFinite(amount) && amount > 0 && amount <= CASHBACK_MAX_DEPOSIT;
}

export function cashbackReleased(installments: CashbackInstallment[]) {
  return installments.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
}

export function currentCashbackSequence(installments: CashbackInstallment[]) {
  return installments.find((item) => item.status === 'pending')?.sequence ?? null;
}

export function countdownLabel(target: string, now: number) {
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}
