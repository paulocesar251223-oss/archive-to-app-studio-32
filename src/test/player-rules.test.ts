import { describe, it, expect } from 'vitest';
import { canPlay, carouselPosition, depositLimitsSchema, exclusionSchema } from '@/lib/player-rules';
describe('Player rules', () => {
 it('only approved and non-excluded accounts can play', () => { expect(canPlay('approved', false)).toBe(true); for (const status of ['pending','rejected','blocked']) expect(canPlay(status, false)).toBe(false); expect(canPlay('approved', true)).toBe(false); });
 it('keeps three slots circular', () => { expect([0,1,2].map(i => carouselPosition(i,2))).toEqual([1,-1,0]); expect([0,1,2].map(i => carouselPosition(i,0))).toEqual([0,1,-1]); });
 it('accepts daily weekly monthly limits including zero and rejects negative limits', () => { expect(depositLimitsSchema.parse({ daily:0, weekly:70, monthly:300 })).toEqual({ daily:0, weekly:70, monthly:300 }); expect(depositLimitsSchema.safeParse({ daily:-1, weekly:70, monthly:300 }).success).toBe(false); });
 it('supports temporary and permanent exclusion', () => { expect(exclusionSchema.parse({ days:null }).days).toBeNull(); expect(exclusionSchema.parse({ days:7 }).days).toBe(7); expect(exclusionSchema.safeParse({ days:0 }).success).toBe(false); });
});