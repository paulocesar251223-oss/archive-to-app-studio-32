import { z } from 'zod';
import { COUNTRY_CODES } from './countries';

export const emailSchema = z.string().trim().email().max(255);
export const passwordSchema = z.string().min(8).max(128);
export const signupSchema = z.object({ email: emailSchema, password: passwordSchema, referral: z.string().trim().toUpperCase().regex(/^([A-Z0-9]{8})?$/) });
export const kycSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  nationality: z.string().refine((value) => COUNTRY_CODES.includes(value)),
  documentNumber: z.string().trim().min(3).max(100),
  address: z.string().trim().min(5).max(500),
});
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function validPhoto(file: { size: number; type: string }) {
  return file.size > 0 && file.size <= MAX_PHOTO_BYTES && PHOTO_TYPES.includes(file.type);
}
export function accountView(profile: { status: string; kyc_submitted_at: string | null }) {
  if (profile.status === 'approved') return 'home';
  if (profile.status === 'blocked') return 'blocked';
  if (profile.status === 'rejected') return 'rejected';
  return profile.kyc_submitted_at ? 'review' : 'kyc';
}