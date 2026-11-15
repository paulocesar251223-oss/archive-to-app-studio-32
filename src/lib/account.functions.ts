import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { kycSchema, validPhoto } from './account-rules';
import { z } from 'zod';

export const getAccount = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('profiles').select('*').eq('user_id', context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Your account profile is missing. Please contact the account administrator.');
  const { data: balance, error: balanceError } = await context.supabase.rpc('get_balance', { _user_id: context.userId });
  if (balanceError) throw new Error(balanceError.message);
  return { profile: data, balance: Number(balance ?? 0) };
});

export const saveLanguage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.enum(['en', 'ru']).parse(input)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('profiles').update({ language: data }).eq('user_id', context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitIdentity = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => kycSchema.extend({ documentPath: z.string().max(200), selfiePath: z.string().max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile, error } = await context.supabase.from('profiles').select('status,kyc_submitted_at').eq('user_id', context.userId).maybeSingle();
    if (error || !profile || !(profile.status === 'rejected' || (profile.status === 'pending' && !profile.kyc_submitted_at))) throw new Error('KYC_NOT_ALLOWED');
    for (const [kind, path] of [['document_front', data.documentPath], ['selfie', data.selfiePath]] as const) {
      if (!path.startsWith(`${context.userId}/`) || path.includes('..')) throw new Error('INVALID_FILE');
      const { data: photo, error: photoError } = await context.supabase.storage.from('kyc').download(path);
      if (photoError || !photo || !validPhoto(photo)) throw new Error('INVALID_FILE');
      const bytes = new Uint8Array(await photo.slice(0, 12).arrayBuffer());
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
      const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
      if (!jpeg && !png && !webp) throw new Error('INVALID_FILE');
      const { error: insertError } = await context.supabase.from('kyc_files').insert({ user_id: context.userId, kind, storage_path: path });
      if (insertError) throw new Error(insertError.message);
    }
    const { error: submitError } = await context.supabase.rpc('submit_kyc', { _full_name: data.fullName, _nationality: data.nationality, _document_number: data.documentNumber, _address: data.address });
    if (submitError) throw new Error(submitError.message);
    return { ok: true };
  });