import { useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, Check, ShieldCheck, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { kycSchema, validPhoto } from '@/lib/account-rules';
import { countryOptions } from '@/lib/countries';
import { submitIdentity } from '@/lib/account.functions';

export function KycForm({ userId }: { userId: string }) {
  const { t, lang } = useI18n(); const client = useQueryClient(); const submitKyc = useServerFn(submitIdentity);
  const [fullName, setFullName] = useState(''); const [nationality, setNationality] = useState(''); const [documentNumber, setDocumentNumber] = useState(''); const [address, setAddress] = useState('');
  const [documentPhoto, setDocumentPhoto] = useState<File | null>(null); const [selfie, setSelfie] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); setError(''); const parsed = kycSchema.safeParse({ fullName, nationality, documentNumber, address });
    if (!parsed.success || !documentPhoto || !selfie) { setError(t.fillAll); return; }
    if (!validPhoto(documentPhoto) || !validPhoto(selfie)) { setError(t.fileTooLarge); return; }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const file of [documentPhoto, selfie]) { const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'; const path = `${userId}/${crypto.randomUUID()}.${ext}`; const { error } = await supabase.storage.from('kyc').upload(path, file, { upsert: false, contentType: file.type }); if (error) throw error; paths.push(path); }
      const [documentPath, selfiePath] = paths; if (!documentPath || !selfiePath) throw new Error('Missing photos');
      await submitKyc({ data: { ...parsed.data, documentPath, selfiePath } }); await client.invalidateQueries({ queryKey: ['account'] });
    } catch { setError(t.genericError); } finally { setBusy(false); }
  }
  function photo(file: File | undefined, setter: (file: File | null) => void) { if (!file) return; if (!validPhoto(file)) { setError(t.fileTooLarge); setter(null); } else { setError(''); setter(file); } }
  return <div className="mx-auto max-w-2xl"><p className="mb-4 flex items-center gap-2 text-xs uppercase text-muted-foreground"><ShieldCheck className="h-4 w-4" />{t.identity}</p><h1 className="mb-8 text-3xl font-semibold">{t.kycTitle}</h1><form className="space-y-6" onSubmit={submit}><div className="grid gap-6 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="nationality">{t.nationality}</Label><select id="nationality" value={nationality} required onChange={e => setNationality(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">{t.selectCountry}</option>{countryOptions(lang).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="full-name">{t.fullName}</Label><Input id="full-name" required minLength={3} maxLength={100} value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" /></div></div><div className="space-y-2"><Label htmlFor="document-number">{t.documentNumber}</Label><Input id="document-number" required minLength={3} maxLength={100} value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="address">{t.address}</Label><Input id="address" required minLength={5} maxLength={500} value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" /></div><div className="grid gap-4 sm:grid-cols-2">{([{ id: 'document-photo', title: t.documentPhoto, file: documentPhoto, setter: setDocumentPhoto }, { id: 'selfie-photo', title: t.selfie, file: selfie, setter: setSelfie }]).map(item => <label key={item.id} htmlFor={item.id} className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-input bg-card p-5 text-center hover:border-ring">{item.file ? <Check className="h-5 w-5" /> : <Upload className="h-5 w-5 text-muted-foreground" />}<span className="text-sm font-medium">{item.title}</span><span className="max-w-full break-all text-xs text-muted-foreground">{item.file?.name ?? t.uploadHint}</span><input id={item.id} aria-label={item.title} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => photo(e.target.files?.[0], item.setter)} /></label>)}</div><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />{t.privatePhotos}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="h-12 w-full justify-between" disabled={busy}>{busy ? t.loading : t.sendKyc}<ArrowRight className="h-4 w-4" /></Button></form></div>;
}