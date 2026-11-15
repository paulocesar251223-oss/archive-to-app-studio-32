import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Clock, ShieldAlert, ShieldCheck, ArrowRight, Diamond } from 'lucide-react';
import { accountQuery } from '@/lib/account-query';
import { accountView } from '@/lib/account-rules';
import { AccountShell } from '@/components/account-shell';
import { KycForm } from '@/components/kyc-form';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { pageHead } from '@/lib/metadata';
import { PlayerShell } from '@/components/player/player-shell';
import { LostTempleHero } from '@/components/player/lost-temple-hero';
import { playerSafetyQuery } from '@/lib/player-query';
function PlayerHome() { const { data } = useSuspenseQuery(playerSafetyQuery); const { t } = useI18n(); return <PlayerShell>{data.excluded ? <div className="px-6 py-20 text-center"><ShieldAlert className="mx-auto mb-5 size-10"/><h1 className="text-2xl font-semibold">{t.excludedTitle}</h1><p className="mt-4 text-muted-foreground">{t.excludedText}</p></div> : <LostTempleHero/>}</PlayerShell>; }
export const Route = createFileRoute('/_authenticated/dashboard')({ head: () => pageHead('Your account', 'Your SOCHI Slots account and identity verification status.'), loader: ({ context }) => context.queryClient.ensureQueryData(accountQuery), component: Dashboard });
function Dashboard() {
  const { data } = useSuspenseQuery(accountQuery); const { t } = useI18n(); const [resubmit, setResubmit] = useState(false); const view = accountView(data.profile);
  if (view === 'home') return <PlayerHome/>;
  return <AccountShell>{view === 'kyc' || (view === 'rejected' && resubmit) ? <KycForm userId={data.profile.user_id} /> : <div className="mx-auto max-w-lg py-12 text-center">{view === 'review' ? <Clock className="mx-auto mb-8 h-12 w-12" /> : <ShieldAlert className="mx-auto mb-8 h-12 w-12" />}<h1 className="mb-5 text-3xl font-semibold">{view === 'review' ? t.reviewTitle : view === 'blocked' ? t.blockedTitle : t.rejectedTitle}</h1><p className="leading-relaxed text-muted-foreground">{view === 'review' ? t.reviewText : view === 'blocked' ? t.blockedText : `${t.rejectedReason}: ${data.profile.rejection_reason ?? t.genericError}`}</p>{view === 'rejected' && <Button className="mt-8" onClick={() => setResubmit(true)}>{t.resubmit}<ArrowRight /></Button>}<Button variant="link" asChild className="mt-6"><Link to="/settings">{t.settings}</Link></Button></div>}</AccountShell>;
}