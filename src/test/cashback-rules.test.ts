import { describe, expect, it } from 'vitest';
import { cashbackReleased, countdownLabel, currentCashbackSequence, isCashbackEligibleDeposit } from '@/lib/cashback-rules';

describe('cashback mission rules', () => {
  it('accepts deposits above zero and up to US$ 200 only', () => {
    expect(isCashbackEligibleDeposit(0)).toBe(false);
    expect(isCashbackEligibleDeposit(0.01)).toBe(true);
    expect(isCashbackEligibleDeposit(200)).toBe(true);
    expect(isCashbackEligibleDeposit(200.01)).toBe(false);
  });

  it('counts only paid US$ 20 installments toward released cashback', () => {
    const installments = [
      { sequence: 1, amount: 20, dueAt: '', status: 'paid' as const, paidAt: 'now' },
      { sequence: 2, amount: 20, dueAt: '', status: 'pending' as const, paidAt: null },
      { sequence: 3, amount: 20, dueAt: '', status: 'cancelled' as const, paidAt: null },
    ];
    expect(cashbackReleased(installments)).toBe(20);
    expect(currentCashbackSequence(installments)).toBe(2);
  });

  it('formats future installment countdowns without going below zero', () => {
    const now = Date.parse('2026-11-15T00:00:00.000Z');
    expect(countdownLabel('2026-11-16T01:02:03.000Z', now)).toBe('25:02:03');
    expect(countdownLabel('2026-11-14T00:00:00.000Z', now)).toBe('00:00:00');
  });
});
