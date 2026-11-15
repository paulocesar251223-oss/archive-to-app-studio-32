import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  ArrowDownToLine, ArrowUpFromLine, Check, CircleDollarSign, Clock3, Copy,
  History, LoaderCircle, Settings, Share2, TriangleAlert, UserPlus,
} from 'lucide-react';
import { walletQuery } from '@/lib/wallet-query';
import { requestReferralLink, requestWithdrawal } from '@/lib/wallet.functions';
import { AchievementBadges, CashbackMission, ReferralCard } from './wallet-extras';
import { withdrawalSchema, type WalletPanel } from '@/lib/wallet-rules';
import { useI18n, type Lang } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function money(value: number, lang: Lang) {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

function dateTime(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through for Telegram webviews without clipboard permission.
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-border px-6 text-center"><Clock3 className="mb-4 size-6 text-muted-foreground" /><h2 className="font-medium">{title}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p></div>;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="pt-6">{children}</div>;
}

export function WalletDashboard({ panel }: { panel: WalletPanel }) {
  const { data } = useSuspenseQuery(walletQuery);
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const client = useQueryClient();
  const request = useServerFn(requestWithdrawal);
  const getReferralLink = useServerFn(requestReferralLink);
  const [notice, setNotice] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const name = data.profile.full_name || data.profile.email?.split('@')[0] || t.account;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const depositAddress = data.profile.solana_wallet_address;
  const deposits = data.ledger.filter((entry) => entry.type === 'deposit');
  const activeTab = panel === 'deposit' ? 'deposits' : panel === 'withdraw' ? 'withdrawals' : panel;

  async function openPanel(next: WalletPanel) {
    setNotice('');
    setFormError('');
    await navigate({ to: '/wallet', search: next === 'history' ? {} : { tab: next } });
  }

  function invite() {
    document.getElementById('referral')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function share() {
    try {
      const { url } = await getReferralLink({});
      if (navigator.share) {
        try {
          await navigator.share({ title: t.appName, text: t.referralReward, url });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      const copied = await copyText(url);
      setNotice(copied ? t.referralCopied : t.genericError);
    } catch {
      setNotice(t.referralError);
    }
  }

  async function copyDepositAddress() {
    if (!depositAddress) return;
    const copied = await copyText(depositAddress);
    setCopiedAddress(copied);
    setNotice(copied ? t.copied : t.genericError);
  }

  async function submitWithdrawal(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    setFormError('');
    const parsed = withdrawalSchema.safeParse({ destinationAddress: destination.trim(), amount: Number(amount) });
    if (!parsed.success) {
      const addressValid = withdrawalSchema.shape.destinationAddress.safeParse(destination.trim()).success;
      setFormError(addressValid ? t.invalidWithdrawalAmount : t.invalidSolanaAddress);
      return;
    }
    setBusy(true);
    try {
      await request({ data: parsed.data });
      setDestination('');
      setAmount('');
      setNotice(t.withdrawalRequested);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['wallet'] }),
        client.invalidateQueries({ queryKey: ['account'] }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setFormError(message.includes('Insufficient balance') ? t.insufficientBalance : message.includes('INVALID_SOLANA_WALLET') ? t.invalidSolanaAddress : message.includes('INVALID_AMOUNT') ? t.invalidWithdrawalAmount : message.includes('WITHDRAWAL_NOT_ALLOWED') ? t.withdrawalNotAllowed : t.genericError);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: 'history' | 'deposits' | 'withdrawals'; label: string }[] = [
    { key: 'history', label: t.history },
    { key: 'deposits', label: t.deposits },
    { key: 'withdrawals', label: t.withdrawals },
  ];

  return <div className="px-5 pb-8 pt-5 sm:px-8">
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold" aria-hidden>{initials}</div>
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t.walletProfile}</p><h1 className="truncate text-sm font-semibold sm:text-base">{name}</h1></div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon" className="sm:w-auto sm:px-3" onClick={() => void invite()} aria-label={t.invite} title={t.invite}><UserPlus /><span className="hidden sm:inline">{t.invite}</span></Button>
        <Button variant="ghost" size="icon" onClick={() => void openPanel('history')} aria-label={t.history} title={t.history}><History /></Button>
        <Button variant="ghost" size="icon" onClick={() => void share()} aria-label={t.share} title={t.share}><Share2 /></Button>
        <Button variant="ghost" size="icon" asChild><Link to="/settings" aria-label={t.settings} title={t.settings}><Settings /></Link></Button>
      </div>
    </header>

    {notice && <p role="status" className="mt-4 border border-border bg-card px-4 py-3 text-sm">{notice}</p>}

    <section className="mt-5 border-y border-border py-7 text-center sm:py-9">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.totalBalance}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{money(data.balance, lang)}</p>
      <p className="mt-2 text-sm font-medium text-muted-foreground">USDC</p>
    </section>

    <div className="mt-5 grid grid-cols-2 gap-3">
      <Button className="h-12 bg-success text-success-foreground hover:bg-success/90" onClick={() => void openPanel('deposit')}><ArrowDownToLine />{t.deposit}</Button>
      <Button variant="outline" className="h-12" onClick={() => void openPanel('withdraw')}><ArrowUpFromLine />{t.withdraw}</Button>
    </div>

    <CashbackMission mission={data.mission} terms={data.missionTerms} />

    <nav className="mt-7 flex overflow-x-auto border-b border-border" aria-label={t.walletProfile}>
      {tabs.map((tab) => <button key={tab.key} type="button" onClick={() => void openPanel(tab.key)} aria-current={activeTab === tab.key ? 'page' : undefined} className={`min-w-max flex-1 border-b-2 px-3 pb-3 text-xs font-medium transition-colors sm:text-sm ${activeTab === tab.key ? 'border-success text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{tab.label}</button>)}
    </nav>

    {panel === 'history' && <Panel>{!data.ledger.length ? <EmptyState title={t.noTransactions} description={t.noTransactionsText} /> : <div>{data.ledger.map((entry) => <article key={entry.id} className="flex items-start gap-3 border-b border-border py-4 last:border-0"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary"><CircleDollarSign className="size-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-medium">{t.transactionType[entry.type]}</h2><p className="mt-1 text-xs text-muted-foreground">{dateTime(entry.created_at, lang)}</p></div><p className={`shrink-0 text-sm font-semibold tabular-nums ${Number(entry.amount) > 0 ? 'text-success' : 'text-foreground'}`}>{Number(entry.amount) > 0 ? '+' : '−'}{money(Math.abs(Number(entry.amount)), lang)}</p></div>{entry.tx_hash && <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground" title={entry.tx_hash}>{entry.tx_hash}</p>}</div></article>)}</div>}</Panel>}

    {panel === 'deposits' && <Panel>{!deposits.length ? <EmptyState title={t.noDeposits} description={t.noDepositsText} /> : <div>{deposits.map((entry) => <article key={entry.id} className="border-b border-border py-4 last:border-0"><div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-medium">{t.transactionType.deposit}</h2><p className="mt-1 text-xs text-muted-foreground">{dateTime(entry.created_at, lang)}</p></div><p className="font-semibold text-success tabular-nums">+{money(Number(entry.amount), lang)} USDC</p></div>{entry.tx_hash && <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground" title={entry.tx_hash}>{entry.tx_hash}</p>}</article>)}</div>}</Panel>}

    {panel === 'deposit' && <Panel><div className="space-y-4">
      <div className="flex items-center justify-between gap-4 border border-border bg-card p-4 opacity-55"><div><h2 className="font-medium">Yandex Pay</h2><p className="mt-1 text-xs text-muted-foreground">{t.yandexRestriction}</p></div><span className="text-xs text-muted-foreground">—</span></div>
      <section className="border border-border bg-card p-5"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success"><CircleDollarSign className="size-5" /></div><div><h2 className="font-semibold">{t.usdcSolana}</h2><p className="mt-1 text-xs text-muted-foreground">{t.solanaNetwork}</p></div></div><div className="mt-5"><Label>{t.depositAddress}</Label>{depositAddress ? <div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all border border-input bg-background p-3 font-mono text-xs leading-5">{depositAddress}</code><Button variant="outline" size="icon" className="size-12 shrink-0" onClick={() => void copyDepositAddress()} aria-label={t.copyAddress} title={t.copyAddress}>{copiedAddress ? <Check className="text-success" /> : <Copy />}</Button></div> : <p className="mt-3 border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">{t.addressPending}</p>}</div><div className="mt-5 flex gap-3 border border-destructive/30 bg-destructive/5 p-4"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /><p className="text-xs leading-5 text-muted-foreground">{t.usdcWarning}</p></div></section>
    </div></Panel>}

    {(panel === 'withdraw' || panel === 'withdrawals') && <Panel><div className="space-y-8">
      <form onSubmit={submitWithdrawal} noValidate className="border border-border bg-card p-5"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-semibold">{t.requestWithdrawal}</h2><p className="text-xs text-muted-foreground">{t.available}: <span className="text-foreground tabular-nums">{money(data.balance, lang)} USDC</span></p></div>{data.excluded ? <p className="text-sm leading-6 text-muted-foreground">{t.excludedText}</p> : <><div className="space-y-2"><Label htmlFor="withdraw-destination">{t.destinationAddress}</Label><Input id="withdraw-destination" value={destination} onChange={(event) => setDestination(event.target.value)} required minLength={32} maxLength={44} autoComplete="off" spellCheck={false} placeholder="Solana" className="font-mono text-xs" disabled={busy} /></div><div className="mt-4 space-y-2"><Label htmlFor="withdraw-amount">{t.withdrawalAmount} · USDC</Label><Input id="withdraw-amount" type="number" inputMode="decimal" min="0.01" step="0.01" max={data.balance > 0 ? data.balance : undefined} required value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} /></div>{formError && <p role="alert" className="mt-4 text-sm text-destructive">{formError}</p>}<Button type="submit" className="mt-5 h-12 w-full" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <ArrowUpFromLine />}{busy ? t.loading : t.requestWithdrawal}</Button></>}</form>
      <section><h2 className="mb-4 text-sm font-semibold">{t.withdrawals}</h2>{!data.withdrawals.length ? <EmptyState title={t.noWithdrawals} description={t.noWithdrawalsText} /> : <div>{data.withdrawals.map((item) => <article key={item.id} className="border-b border-border py-4 last:border-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold tabular-nums">{money(Number(item.amount), lang)} USDC</p><p className="mt-1 text-xs text-muted-foreground">{dateTime(item.created_at, lang)}</p></div><span className={`border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${item.status === 'paid' ? 'border-success/30 bg-success/10 text-success' : item.status === 'rejected' ? 'border-destructive/30 text-destructive' : 'border-border text-muted-foreground'}`}>{t.withdrawalStatus[item.status]}</span></div><p className="mt-3 font-mono text-xs text-muted-foreground" title={item.destination_address}>{shortAddress(item.destination_address)}</p>{item.rejection_reason && <p className="mt-2 text-xs text-destructive">{item.rejection_reason}</p>}{item.tx_hash && <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground" title={item.tx_hash}>{item.tx_hash}</p>}</article>)}</div>}</section>
    </div></Panel>}

    <ReferralCard />
    <AchievementBadges achievements={data.achievements} />
  </div>;
}
