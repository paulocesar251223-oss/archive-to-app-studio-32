import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, ArrowLeft, Mail, Diamond } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccountShell } from './account-shell';
import { emailSchema, passwordSchema, signupSchema } from '@/lib/account-rules';

export function AuthScreen({ mode = 'login', initialReferral = '' }: { mode?: 'login' | 'register' | 'forgot'; initialReferral?: string }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  async function goAfterLogin(userId: string, recovery = false) {
    if (recovery) { await navigate({ to: '/reset-password', replace: true }); return; }
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    await navigate({ to: roles?.length ? '/admin' : '/dashboard', replace: true });
  }
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) { const recovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'; void goAfterLogin(data.user.id, recovery); } }); }, [navigate]);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [referral, setReferral] = useState(initialReferral);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const title = mode === 'register' ? t.register : mode === 'forgot' ? t.sendReset : t.login;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (!emailSchema.safeParse(email).success || (mode !== 'forgot' && !passwordSchema.safeParse(password).success) || (mode === 'register' && !signupSchema.safeParse({ email, password, referral }).success)) { setError(t.invalidInput); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error; setMessage(t.resetSent);
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { referral_code: referral.trim().toUpperCase() || undefined, language: lang } } });
        if (error) throw error;
        if (data.session) await navigate({ to: '/dashboard' }); else setMessage(t.checkEmail);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.user) await goAfterLogin(data.user.id);
      }
    } catch (err) { const code = (err as { code?: string }).code; setError(code === 'invalid_credentials' ? t.invalidCredentials : code === 'email_not_confirmed' ? t.emailNotConfirmed : t.genericError); }
    finally { setBusy(false); }
  }
  return <AccountShell><div className="mx-auto max-w-md"><div className="mb-10 flex h-16 w-16 items-center justify-center border border-border"><Diamond className="h-8 w-8" /></div><p className="mb-3 text-xs uppercase text-muted-foreground">{t.appName}</p><h1 className="mb-10 text-4xl font-semibold">{title}</h1>{message ? <div className="space-y-6"><Mail className="h-8 w-8" /><p role="status" className="leading-relaxed">{message}</p><Button variant="outline" asChild><Link to="/auth">{t.backToLogin}<ArrowLeft /></Link></Button></div> : <form onSubmit={submit} className="space-y-6"><div className="space-y-2"><Label htmlFor="email">{t.email}</Label><Input id="email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></div>{mode !== 'forgot' && <div className="space-y-2"><div className="flex justify-between"><Label htmlFor="password">{t.password}</Label>{mode === 'login' && <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">{t.forgot}</Link>}</div><Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">{t.passwordHint}</p></div>}{mode === 'register' && <div className="space-y-2"><Label htmlFor="referral">{t.referralCode}</Label><Input id="referral" value={referral} maxLength={8} onChange={e => setReferral(e.target.value.toUpperCase())} /></div>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="h-12 w-full justify-between" disabled={busy}>{busy ? t.loading : title}<ArrowRight className="h-4 w-4" /></Button><div className="border-t border-border pt-6 text-center text-sm"><Link className="text-muted-foreground hover:text-foreground" to={mode === 'login' ? '/register' : '/auth'}>{mode === 'login' ? t.register : t.backToLogin}</Link></div></form>}</div></AccountShell>;
}