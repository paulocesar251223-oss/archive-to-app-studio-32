import { z } from 'zod';
export const depositLimitsSchema = z.object({ daily: z.number().finite().min(0).max(1e9), weekly: z.number().finite().min(0).max(1e9), monthly: z.number().finite().min(0).max(1e9) });
export const exclusionSchema = z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]) });
export function canPlay(status: string, excluded: boolean) { return status === 'approved' && !excluded; }
export function carouselPosition(index: number, active: number) { const offset = (index - active + 3) % 3; return offset === 2 ? -1 : offset; }