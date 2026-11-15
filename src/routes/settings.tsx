import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { LogOut, ArrowLeft, Send } from 'lucide-react';
import { AccountShell } from '@/components/account-shell';
import { Button } from '@/components/ui/button';
import { useI18n, type Lang } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { saveLanguage } from '@/lib/account.functions';
import { linkTelegram } from '@/lib/telegram.functions';
import { pageHead } from '@/lib/metadata';
import { accountQuery } from '@/lib/account-query';
import { PlayerSettings } from '@/components/player/player-settings';
export const Route = createFileRoute('/settings')({ head: () => pageHead('Settings', 'Manage language and Telegram preferences for Obsidian Slots.'), component: Settings });
function Settings() {
  const profile = useQuery({ ...accountQuery, retry: false });
  const { t, lang, setLang } = useI18n(); const client = useQueryClient(); const navigate = useNavigate(); const save = useServerFn(saveLanguage); const link = useServerFn(linkTelegram); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function changeLanguage(next: Lang) { setBusy(true); setMessage(''); try { const { data } = await supabase.auth.getUser(); if (data.user) await save({ data: next }); setLang(next); } catch { setMessage(t.genericError); } finally { setBusy(false); } }
  async function telegram() { setBusy(true); setMessage(''); try { const initData = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData; if (!initData) { setMessage(t.openTelegram); return; } const { data } = await supabase.auth.getUser(); if (!data.user) { await navigate({ to: '/auth' }); return; } const result = await link({ data: { initData } }); setMessage(result.ok ? t.tgLinked : (t[`tg_${result.code}` as keyof typeof t] as string | undefined) ?? t.genericError); await client.invalidateQueries({ queryKey: ['account'] }); } catch { setMessage(t.genericError); } finally { setBusy(false); } }
  async function signOut() { await client.cancelQueries(); client.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }); }
  if (profile.data?.profile.status === 'approved') return <PlayerSettings/>;
  return <AccountShell><div className="mx-auto max-w-xl"><h1 className="mb-12 text-4xl font-semibold">{t.settings}</h1><div className="border-y border-border py-7"><p className="mb-4 text-sm text-muted-foreground">{t.language}</p><div className="flex gap-3"><Button disabled={busy} variant={lang === 'en' ? 'default' : 'outline'} aria-pressed={lang === 'en'} onClick={() => changeLanguage('en')}>English</Button><Button disabled={busy} variant={lang === 'ru' ? 'default' : 'outline'} aria-pressed={lang === 'ru'} onClick={() => changeLanguage('ru')}>Русский</Button></div></div><div className="border-b border-border py-7"><p className="mb-4 text-sm text-muted-foreground">{t.telegram}</p><Button disabled={busy} variant="outline" onClick={telegram}><Send className="h-4 w-4" />{t.linkTelegram}</Button></div>{message && <p role="status" className="mt-5 text-sm">{message}</p>}<div className="mt-10 flex justify-between"><Button variant="ghost" asChild><Link to="/dashboard"><ArrowLeft />{t.home}</Link></Button><Button variant="ghost" onClick={signOut}><LogOut />{t.signOut}</Button></div></div></AccountShell>;
}