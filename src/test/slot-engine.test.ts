import { describe, expect, it } from 'vitest';
import { generateSlotRounds, getWinningLines, randomServerSeed, sha256Hex, SLOT_WIN_CHANCE, SPIN_RATE_LIMIT, SPIN_RATE_WINDOW_SECONDS, spinSchema } from '@/lib/slot-engine';

describe('slot engine rules', () => {
  it('accepts only the requested bets and 1, 10 or 100 spins', () => {
    const base = { sessionId: crypto.randomUUID(), requestId: crypto.randomUUID(), game: 'lost-temple' };
    expect(spinSchema.safeParse({ ...base, bet: 0.2, spins: 1 }).success).toBe(true);
    expect(spinSchema.safeParse({ ...base, bet: 100, spins: 100 }).success).toBe(true);
    expect(spinSchema.safeParse({ ...base, bet: 0.3, spins: 1 }).success).toBe(false);
    expect(spinSchema.safeParse({ ...base, bet: 1, spins: 5 }).success).toBe(false);
  });

  it('pays three matching symbols on the middle and both diagonals only', () => {
    const middle = [[0, 2, 1], [3, 2, 4], [1, 2, 5]];
    const down = [[2, 0, 1], [3, 2, 4], [1, 5, 2]];
    const up = [[0, 3, 2], [3, 2, 4], [2, 5, 1]];
    expect(getWinningLines(middle)).toEqual([{ line: 'middle', symbol: 2 }]);
    expect(getWinningLines(down)).toEqual([{ line: 'diagonalDown', symbol: 2 }]);
    expect(getWinningLines(up)).toEqual([{ line: 'diagonalUp', symbol: 2 }]);
  });

  it('reduces the original 25% winning frequency by exactly 15%', () => {
    expect(SLOT_WIN_CHANCE).toBe(0.25 * 0.85);
    expect(SLOT_WIN_CHANCE).toBe(0.2125);
  });

  it('uses the confirmed five-request ten-second user window', () => {
    expect(SPIN_RATE_LIMIT).toBe(5);
    expect(SPIN_RATE_WINDOW_SECONDS).toBe(10);
  });

  it('generates a cryptographically random 32-byte seed and publishes its SHA-256 hash', async () => {
    const first = randomServerSeed();
    const second = randomServerSeed();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
    expect(await sha256Hex('obsidian')).toBe('4e2295dd929e424aa1afde7049924cb231f451c9884d7915ae33690b73b227ec');
  });

  it('is deterministic, returns 3x3 grids and pays only server-declared winning lines', async () => {
    const options = { serverSeed: 'a'.repeat(64), clientSeed: 'player_seed', startNonce: 7, bet: 1, spins: 10 as const, rtp: 96 };
    const first = await generateSlotRounds(options);
    const second = await generateSlotRounds(options);
    expect(first).toEqual(second);
    expect(first).toHaveLength(10);
    expect(first.every((round) => round.reels.length === 3 && round.reels.every((reel) => reel.length === 3))).toBe(true);
    expect(first.every((round) => JSON.stringify(round.winningLines) === JSON.stringify(getWinningLines(round.reels)))).toBe(true);
    expect(first.every((round) => round.payout === 0 || round.payout === 4.52)).toBe(true);
  });
});
