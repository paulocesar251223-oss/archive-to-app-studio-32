import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CircleDollarSign, Clock3, Copy, Crown, Flame, Gift, LockKeyhole, Sparkles, Trophy, UserPlus } from 'lucide-react';
import { getReferralLink, requestReferralCode } from '@/lib/wallet.functions';
import { CASHBACK_INSTALLMENT_AMOUNT, CASHBACK_INSTALLMENTS, CASHBACK_TOTAL, cashbackReleased, countdownLabel, currentCashbackSequence, type CashbackInstallment } from '@/lib/cashback-rules';
import { useI18n, type Lang } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Mission = {
  status: string;
  totalAmount: number;
  installments: CashbackInstallment[];
} | null;

type MissionTerms = {
  rollover: number;
  expiresDays: number;
  terms: string;
  withdrawalRules: string;
};

function money(value: number, lang: Lang) {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 }).format(value);
}

function Countdown({ target }: { target: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => setLabel(countdownLabel(target, Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);
  return <span className="font-mono tabular-nums">{label || '--:--:--'}</span>;
}

export function CashbackMission({ mission, terms }: { mission: Mission; terms: MissionTerms }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const installments = mission?.installments ?? [];
  const released = cashbackReleased(installments);
  const current = currentCashbackSequence(installments);
  const complete = installments.length === CASHBACK_INSTALLMENTS && current === null;
  const cards = Array.from({ length: CASHBACK_INSTALLMENTS }, (_, index) => installments.find((item) => item.sequence === index + 1) ?? null);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-5 flex w-full items-center gap-4 border border-success/35 bg-success/10 p-4 text-left transition-colors hover:bg-success/15" aria-haspopup="dialog">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"><Gift className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-success">{t.cashbackMission}</span><span className="mt-1 block text-sm font-semibold">{t.cashbackAlertTitle}</span><span className="mt-1 block text-xs text-muted-foreground">{t.cashbackAlertText}</span></span>
      <ArrowRight className="size-4 shrink-0 text-success" />
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-auto bottom-0 max-h-[92vh] translate-y-0 gap-0 overflow-y-auto rounded-t-2xl border-border bg-background px-2 pb-0 sm:max-w-lg">
        <DialogHeader className="px-3 pt-5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success">{t.cashbackMission}</p>
          <DialogTitle className="mt-2 text-xl leading-7">US$ {money(released, lang)} / US$ {CASHBACK_TOTAL} {t.cashbackReleased}</DialogTitle>
          <DialogDescription className="mt-2 leading-6">{complete ? t.cashbackComplete : mission ? t.cashbackSupportActive : t.cashbackSupportNoMission}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-1.5 px-3 py-3">
          {cards.map((item, index) => {
            const paid = item?.status === 'paid';
            const isCurrent = item?.status === 'pending' && item.sequence === current;
            return <div key={index} className={`flex min-h-28 flex-col items-center justify-center border px-1 py-3 text-center ${paid ? 'border-success/40 bg-success/10' : isCurrent ? 'border-success bg-success/5' : 'border-border bg-card opacity-50'}`}>
              <span className={`flex size-7 items-center justify-center rounded-full ${paid ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'}`}>{paid ? <Check className="size-4" /> : <LockKeyhole className="size-3.5" />}</span>
              <span className="mt-2 text-xs font-semibold">US$ {CASHBACK_INSTALLMENT_AMOUNT}</span>
              <span className="mt-1 text-[9px] text-muted-foreground">{t.day} {index + 1}</span>
              {isCurrent && <span className="mt-1 text-[9px] font-medium text-success">{t.today}</span>}
              {item?.status === 'pending' && !isCurrent && <span className="mt-1 text-[9px] text-muted-foreground"><Countdown target={item.dueAt} /></span>}
              {!item && <span className="mt-1 text-[9px] text-muted-foreground">{t.afterDeposit}</span>}
            </div>;
          })}
        </div>
        <div className="px-3">
          <button type="button" onClick={() => setShowTerms((value) => !value)} className="text-sm font-medium text-success underline underline-offset-4">{showTerms ? t.hideTerms : t.viewTerms}</button>
          {showTerms && <section className="mt-4 space-y-4 border border-border bg-card p-4 text-sm leading-6">
            <p className="whitespace-pre-wrap text-muted-foreground">{terms.terms || t.cashbackAlertText}</p>
            <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">{t.rollover}</p><p className="font-semibold">{mission?.installments.length && mission ? `${terms.rollover}x` : `${terms.rollover}x`}</p></div><div><p className="text-xs text-muted-foreground">{t.missionDeadline}</p><p className="font-semibold">{terms.expiresDays} {t.days}</p></div></div>
            <div><p className="text-xs text-muted-foreground">{t.withdrawalRules}</p><p className="mt-1 whitespace-pre-wrap">{terms.withdrawalRules}</p></div>
          </section>}
        </div>
        <DialogFooter className="px-3 pb-8 pt-5"><Button asChild className="h-12 w-full bg-success text-success-foreground hover:bg-success/90"><Link to="/dashboard" onClick={() => setOpen(false)}>{t.playNow}<ArrowRight /></Link></Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

type ReferralStatus = 'not_requested' | 'pending' | 'approved';

export function ReferralCard({ status: initialStatus }: { status: ReferralStatus }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const requestCode = useServerFn(requestReferralCode);
  const getLink = useServerFn(getReferralLink);
  const [status, setStatus] = useState<ReferralStatus>(initialStatus);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError(false);
    try {
      if (status === 'not_requested') {
        const result = await requestCode({});
        setStatus(result.status as ReferralStatus);
        await client.invalidateQueries({ queryKey: ['wallet'] });
      } else if (status === 'approved') {
        const result = await getLink({});
        setUrl(result.url);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return <section id="referral" className="mt-8 border border-border bg-card p-5">
    <div className="flex items-start gap-3"><UserPlus className="mt-0.5 size-5 shrink-0 text-success" /><div><h2 className="font-semibold">{t.referralTitle}</h2><p className="mt-1 text-sm font-medium text-success">{t.referralReward}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{t.referralProtection}</p></div></div>
    {status === 'pending' ? <div role="status" className="mt-4 flex items-center justify-center gap-2 border border-border bg-background p-3 text-sm text-muted-foreground"><Clock3 className="size-4" />{t.referralPending}</div> : url ? <div className="mt-4"><div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate border border-border bg-background p-3 text-xs">{url}</code><Button variant="outline" size="icon" onClick={() => void copy()} aria-label={t.copy}><Copy /></Button></div>{copied && <p role="status" className="mt-2 text-xs text-success">{t.referralCopied}</p>}</div> : <Button variant="outline" className="mt-4 w-full" disabled={busy} onClick={() => void generate()}>{busy ? t.loading : status === 'approved' ? t.viewReferralLink : t.requestReferralCode}</Button>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{t.referralError}</p>}
  </section>;
}

type Badge = { id: string; code: string; titleEn: string; titleRu: string; descriptionEn: string; descriptionRu: string; unlockedAt: string | null; icon: string };
const badgeIcons = { 'circle-dollar-sign': CircleDollarSign, sparkles: Sparkles, flame: Flame, crown: Crown };

export function AchievementBadges({ achievements }: { achievements: Badge[] }) {
  const { t, lang } = useI18n();
  return <section className="mt-10 pb-4"><div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="flex items-center gap-2 font-semibold"><Trophy className="size-5 text-success" />{t.achievements}</h2><p className="mt-1 text-xs text-muted-foreground">{t.achievementsText}</p></div><span className="text-xs tabular-nums text-muted-foreground">{achievements.filter((item) => item.unlockedAt).length}/{achievements.length}</span></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{achievements.map((item) => {
      const unlocked = Boolean(item.unlockedAt);
      const Icon = badgeIcons[item.icon as keyof typeof badgeIcons] ?? Trophy;
      return <article key={item.id} className={`relative border p-4 ${unlocked ? 'border-success/35 bg-success/5' : 'border-border bg-card opacity-45'}`}>
        <div className="flex items-center justify-between"><Icon className={`size-6 ${unlocked ? 'text-success' : 'text-muted-foreground'}`} />{unlocked ? <Check className="size-4 text-success" /> : <LockKeyhole className="size-4 text-muted-foreground" />}</div>
        <h3 className="mt-4 text-sm font-semibold">{lang === 'ru' ? item.titleRu : item.titleEn}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{lang === 'ru' ? item.descriptionRu : item.descriptionEn}</p><p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">{unlocked ? t.unlocked : t.locked}</p>
      </article>;
    })}</div>
  </section>;
}
