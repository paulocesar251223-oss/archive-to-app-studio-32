import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { accountQuery } from '@/lib/account-query';
import { PlayerShell } from '@/components/player/player-shell';
import { pageHead } from '@/lib/metadata';
import { useI18n } from '@/i18n';
import blackjack from '@/assets/playboy-blackjack.webp.asset.json';
import baccarat from '@/assets/playboy-baccarat.webp.asset.json';
import roulette from '@/assets/playboy-roulette.webp.asset.json';

const liveGames = [
  { name: 'Blackjack', image: blackjack.url },
  { name: 'Baccarat', image: baccarat.url },
  { name: 'Roulette', image: roulette.url },
];

export const Route = createFileRoute('/_authenticated/rewards')({
  head: () => pageHead('Playboy Live Cassino', 'Playboy Live Cassino at Obsidian Slots.'),
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
            <article className="live-casino-card" key={game.name}>
              <img
                src={game.image}
                alt={`Playboy ${game.name}`}
                width="1600"
                height="900"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </article>
          ))}
        </div>
      </section>
    </PlayerShell>
  );
}
