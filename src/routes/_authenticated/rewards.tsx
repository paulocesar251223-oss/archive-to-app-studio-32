import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { accountQuery } from '@/lib/account-query';
import { PlayerShell } from '@/components/player/player-shell';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { pageHead } from '@/lib/metadata';
import { useI18n } from '@/i18n';

const liveGames = [
  { name: 'Blackjack', image: '/images/playboy-blackjack.webp' },
  { name: 'Baccarat', image: '/images/playboy-baccarat.webp' },
  { name: 'Roulette', image: '/images/playboy-roulette.webp' },
];

export const Route = createFileRoute('/_authenticated/rewards')({
  head: () => pageHead('Playboy Live Cassino', 'Playboy Live Cassino at SOCHI Slots.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQuery),
  component: Rewards,
});

function Rewards() {
  const { data } = useSuspenseQuery(accountQuery);
  const { t } = useI18n();

  if (data.profile.status !== 'approved') return <Navigate to="/dashboard" />;

  return (
    <PlayerShell>
      <section className="live-casino" aria-labelledby="live-casino-title">
        <h1 id="live-casino-title">{t.centerTab}</h1>
        <div className="live-casino-list">
          {liveGames.map((game, index) => (
            <Dialog key={game.name}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="live-casino-card"
                  aria-label={`${game.name} — ${t.liveGameLocked}`}
                >
                  <img
                    src={game.image}
                    alt={`Playboy ${game.name}`}
                    width="1600"
                    height="900"
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                  <span className="live-casino-lock" aria-hidden="true">
                    <span className="live-casino-lock-badge">
                      <LockKeyhole size={28} strokeWidth={1.7} />
                    </span>
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100%-32px)] rounded-xl sm:max-w-md">
                <DialogHeader className="text-center">
                  <span className="live-casino-dialog-icon" aria-hidden="true">
                    <LockKeyhole size={25} strokeWidth={1.7} />
                  </span>
                  <DialogTitle>{t.liveGameLocked}</DialogTitle>
                  <DialogDescription className="pt-2 leading-6">
                    {t.liveGameDepositMinimum}
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </section>
    </PlayerShell>
  );
}
