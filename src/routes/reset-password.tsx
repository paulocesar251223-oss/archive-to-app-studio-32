import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AccountShell } from '@/components/account-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n';
import { passwordSchema } from '@/lib/account-rules';
import { pageHead } from '@/lib/metadata';
export const Route = createFileRoute('/reset-password')({ head: () => pageHead('Reset password', 'Set a new password for your SOCHI Slots account.'), component: ResetPassword });
function ResetPassword() {
  const { t } = useI18n(); const [valid, setValid] = useState(false); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  useEffect(() => { const recovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery' || sessionStorage.getItem('password_recovery') === '1'; supabase.auth.getUser().then(({ data }) => setValid(recovery && Boolean(data.user))); }, []);
  async function submit(e: FormEvent) { e.preventDefault(); if (!valid || !passwordSchema.safeParse(password).success) { setError(t.invalidInput); return; } setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setBusy(false); if (error) setError(t.genericError); else { sessionStorage.removeItem('password_recovery'); setDone(true); } }
  return <AccountShell><div className="mx-auto max-w-md"><h1 className="mb-8 text-3xl font-semibold">{t.newPassword}</h1>{done ? <p role="status">{t.passwordUpdated}</p> : valid ? <form className="space-y-6" onSubmit={submit}><Label htmlFor="new-password">{t.newPassword}</Label><Input id="new-password" type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />{error && <p role="alert">{error}</p>}<Button disabled={busy} className="w-full">{busy ? t.loading : t.setPassword}</Button></form> : <p>{t.invalidRecovery}</p>}<Button asChild variant="link" className="mt-6"><Link to="/auth">{t.backToLogin}</Link></Button></div></AccountShell>;
}