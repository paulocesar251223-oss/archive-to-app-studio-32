import { describe, expect, it } from 'vitest';
import { balanceAdjustmentSchema, kycReviewSchema, referralCodeApprovalSchema, withdrawalReviewSchema } from '@/lib/admin-rules';

const WALLET = 'So11111111111111111111111111111111111111112';
const TX = '5'.repeat(88);
const USER = '00000000-0000-4000-8000-000000000001';
const WITHDRAWAL = '00000000-0000-4000-8000-000000000002';

describe('Admin security and money rules', () => {
  it('requires the manually assigned Solana wallet when approving KYC', () => {
    expect(kycReviewSchema.safeParse({ userId: USER, decision: 'approve', wallet: '', reason: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ userId: USER, decision: 'approve', wallet: WALLET, reason: '' }).success).toBe(true);
  });
  it('requires a rejection reason for KYC', () => {
    expect(kycReviewSchema.safeParse({ userId: USER, decision: 'reject', reason: 'ab' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ userId: USER, decision: 'reject', reason: 'Documento ilegível' }).success).toBe(true);
  });
  it('requires a reason and a transaction hash for deposit credit', () => {
    expect(balanceAdjustmentSchema.safeParse({ userId: USER, kind: 'deposit', amount: 100, reason: '', txHash: TX }).success).toBe(false);
    expect(balanceAdjustmentSchema.safeParse({ userId: USER, kind: 'deposit', amount: 100, reason: 'Depósito confirmado', txHash: '' }).success).toBe(false);
    expect(balanceAdjustmentSchema.safeParse({ userId: USER, kind: 'deposit', amount: 100, reason: 'Depósito confirmado', txHash: TX }).success).toBe(true);
  });
  it('allows a negative manual adjustment but never a negative deposit', () => {
    expect(balanceAdjustmentSchema.safeParse({ userId: USER, kind: 'adjustment', amount: -25, reason: 'Correção operacional', txHash: '' }).success).toBe(true);
    expect(balanceAdjustmentSchema.safeParse({ userId: USER, kind: 'deposit', amount: -25, reason: 'Correção operacional', txHash: TX }).success).toBe(false);
  });
  it('allows admin-generated codes or a custom 8-character referral code', () => {
    expect(referralCodeApprovalSchema.safeParse({ userId: USER, code: '' }).success).toBe(true);
    expect(referralCodeApprovalSchema.safeParse({ userId: USER, code: 'abc12345' }).success).toBe(true);
    expect(referralCodeApprovalSchema.safeParse({ userId: USER, code: 'SHORT' }).success).toBe(false);
    expect(referralCodeApprovalSchema.safeParse({ userId: USER, code: 'ABC12345' }).success).toBe(true);
  });
  it('requires a transaction hash only when marking a withdrawal paid', () => {
    expect(withdrawalReviewSchema.safeParse({ withdrawalId: WITHDRAWAL, decision: 'pay', txHash: '' }).success).toBe(false);
    expect(withdrawalReviewSchema.safeParse({ withdrawalId: WITHDRAWAL, decision: 'pay', txHash: TX }).success).toBe(true);
    expect(withdrawalReviewSchema.safeParse({ withdrawalId: WITHDRAWAL, decision: 'approve', txHash: '' }).success).toBe(true);
  });
  it('requires a reason when rejecting a withdrawal', () => {
    expect(withdrawalReviewSchema.safeParse({ withdrawalId: WITHDRAWAL, decision: 'reject', reason: '' }).success).toBe(false);
    expect(withdrawalReviewSchema.safeParse({ withdrawalId: WITHDRAWAL, decision: 'reject', reason: 'Endereço incorreto' }).success).toBe(true);
  });
});
