import { describe, it, expect } from 'vitest';
import { accountView, kycSchema, signupSchema, validPhoto } from '@/lib/account-rules';
describe('Account rules', () => {
  it('allows signup with no referral code', () => { expect(signupSchema.safeParse({ email: 'person@example.com', password: 'long-password', referral: '' }).success).toBe(true); });
  it('requires a valid referral if supplied', () => { expect(signupSchema.safeParse({ email: 'person@example.com', password: 'long-password', referral: 'ABC12345' }).success).toBe(true); expect(signupSchema.safeParse({ email: 'person@example.com', password: 'long-password', referral: '<script>' }).success).toBe(false); });
  it('requires all identity fields', () => { const data = { fullName: 'Test Person', nationality: 'BR', documentNumber: 'ABC123', address: 'Test address' }; expect(kycSchema.safeParse(data).success).toBe(true); for (const key of Object.keys(data)) expect(kycSchema.safeParse({ ...data, [key]: '' }).success).toBe(false); });
  it('routes pending submissions to review, not home', () => { expect(accountView({ status: 'pending', kyc_submitted_at: '2026-11-15' })).toBe('review'); expect(accountView({ status: 'pending', kyc_submitted_at: null })).toBe('kyc'); });
  it('allows rejected resubmission', () => { expect(accountView({ status: 'rejected', kyc_submitted_at: '2026-11-15' })).toBe('rejected'); });
  it('blocks blocked accounts', () => { expect(accountView({ status: 'blocked', kyc_submitted_at: null })).toBe('blocked'); });
  it('shows home only for approved accounts', () => { expect(accountView({ status: 'approved', kyc_submitted_at: '2026-11-15' })).toBe('home'); });
  it('accepts only photos up to 10 MB', () => { expect(validPhoto({ type: 'image/jpeg', size: 10 * 1024 * 1024 })).toBe(true); expect(validPhoto({ type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 })).toBe(false); expect(validPhoto({ type: 'text/html', size: 100 })).toBe(false); });
});