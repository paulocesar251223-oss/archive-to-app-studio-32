import { z } from 'zod';

export const SLOT_BET_VALUES = [0.20, 0.50, 1, 2, 5, 10, 15, 20, 25, 50, 100] as const;
export const SLOT_SPIN_COUNTS = [1, 10, 100] as const;
export const SLOT_SYMBOLS = 6;
export const SPIN_RATE_LIMIT = 5;
export const SPIN_RATE_WINDOW_SECONDS = 10;
// Owner request: make wins 15% less frequent than the original 25% chance.
export const SLOT_WIN_CHANCE = 0.2125;

export const SLOT_PAYLINES = [
  { id: 'middle', positions: [[0, 1], [1, 1], [2, 1]] },
  { id: 'diagonalDown', positions: [[0, 0], [1, 1], [2, 2]] },
  { id: 'diagonalUp', positions: [[0, 2], [1, 1], [2, 0]] },
] as const;

export type PaylineId = typeof SLOT_PAYLINES[number]['id'];
export type WinningLine = { line: PaylineId; symbol: number };
export type SlotRound = { reels: number[][]; payout: number; winningLines: WinningLine[] };

export const clientSeedSchema = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);
export const prepareSpinSchema = z.object({
  game: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/),
  clientSeed: clientSeedSchema,
});
export const spinSchema = z.object({
  sessionId: z.union([z.string().uuid(), z.string().regex(/^demo_[a-f0-9]{64}$/)]),
  requestId: z.string().uuid(),
  game: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/),
  bet: z.number().finite().refine((value) => SLOT_BET_VALUES.includes(value as typeof SLOT_BET_VALUES[number]), 'INVALID_BET'),
  spins: z.union([z.literal(1), z.literal(10), z.literal(100)]),
});

export function getWinningLines(reels: number[][]): WinningLine[] {
  if (reels.length !== 3 || reels.some((reel) => reel.length !== 3)) return [];
  return SLOT_PAYLINES.flatMap((payline) => {
    const symbols = payline.positions.map(([reel, row]) => reels[reel]?.[row]);
    return symbols.every((symbol) => symbol === symbols[0]) ? [{ line: payline.id, symbol: symbols[0] ?? 0 }] : [];
  });
}

export function randomServerSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function uint32(bytes: Uint8Array, index: number) {
  const offset = index * 4;
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

function uniform(bytes: Uint8Array, index: number) {
  return uint32(bytes, index) / 4_294_967_296;
}

async function fairBytes(key: CryptoKey, clientSeed: string, nonce: number, draw: number) {
  const message = new TextEncoder().encode(`${clientSeed}:${nonce}:${draw}`);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
}

function candidateGrid(bytes: Uint8Array) {
  return Array.from({ length: 3 }, (_, reel) => Array.from({ length: 3 }, (_, row) => (bytes[reel * 3 + row] ?? 0) % SLOT_SYMBOLS));
}

export async function generateSlotRounds(options: {
  serverSeed: string;
  clientSeed: string;
  startNonce: number;
  bet: number;
  spins: 1 | 10 | 100;
  rtp: number;
}): Promise<SlotRound[]> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(options.serverSeed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const winMultiplier = options.rtp / 100 / SLOT_WIN_CHANCE;
  const rounds: SlotRound[] = [];

  for (let spin = 0; spin < options.spins; spin += 1) {
    const nonce = options.startNonce + spin;
    const first = await fairBytes(key, options.clientSeed, nonce, 0);
    const won = uniform(first, 0) < SLOT_WIN_CHANCE;
    const selectedLine = SLOT_PAYLINES[Math.floor(uniform(first, 1) * SLOT_PAYLINES.length)] ?? SLOT_PAYLINES[0];
    const winSymbol = Math.floor(uniform(first, 2) * SLOT_SYMBOLS);
    let reels = candidateGrid(first);
    let winningLines: WinningLine[] = [];

    for (let attempt = 0; attempt < 64; attempt += 1) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${options.clientSeed}:${nonce}:${attempt}:${[...first].join(',')}`));
      const candidate = candidateGrid(new Uint8Array(digest));
      if (won) {
        for (const [reel, row] of selectedLine.positions) candidate[reel]![row] = winSymbol;
      }
      const lines = getWinningLines(candidate);
      if ((!won && lines.length === 0) || (won && lines.length === 1 && lines[0]?.line === selectedLine.id)) {
        reels = candidate;
        winningLines = lines;
        break;
      }
    }

    const payout = winningLines.length > 0 ? Math.round(options.bet * winMultiplier * winningLines.length * 100) / 100 : 0;
    rounds.push({ reels, payout, winningLines });
  }
  return rounds;
}
