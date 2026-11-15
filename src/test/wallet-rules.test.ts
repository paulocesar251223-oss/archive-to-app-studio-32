import { describe, expect, it } from 'vitest';
import { solanaAddressSchema, withdrawalSchema } from '@/lib/wallet-rules';

const systemProgram = '11111111111111111111111111111111';

describe('Wallet withdrawal rules', () => {
  it('accepts a base58 Solana address with 32 to 44 characters', () => {
    expect(solanaAddressSchema.safeParse(systemProgram).success).toBe(true);
    expect(solanaAddressSchema.safeParse(`${systemProgram}111111111111`).success).toBe(true);
  });

  it('rejects malformed Solana addresses and ambiguous base58 characters', () => {
    expect(solanaAddressSchema.safeParse('not-a-wallet').success).toBe(false);
    expect(solanaAddressSchema.safeParse('0OIl1111111111111111111111111111').success).toBe(false);
    expect(solanaAddressSchema.safeParse(`${systemProgram}1`).success).toBe(true);
    expect(solanaAddressSchema.safeParse(`${systemProgram}1111111111111`).success).toBe(false);
  });

  it('requires a positive withdrawal of at least 0.01 with at most two decimals', () => {
    expect(withdrawalSchema.safeParse({ destinationAddress: systemProgram, amount: 0 }).success).toBe(false);
    expect(withdrawalSchema.safeParse({ destinationAddress: systemProgram, amount: -2 }).success).toBe(false);
    expect(withdrawalSchema.safeParse({ destinationAddress: systemProgram, amount: 0.001 }).success).toBe(false);
    expect(withdrawalSchema.safeParse({ destinationAddress: systemProgram, amount: 0.01 }).success).toBe(true);
    expect(withdrawalSchema.safeParse({ destinationAddress: systemProgram, amount: 25.50 }).success).toBe(true);
  });

  it('rejects withdrawals above one billion', () => {
    expect(withdrawalSchema.safeParse({ destinationAddress: systemProgram, amount: 1_000_000_001 }).success).toBe(false);
  });
});
