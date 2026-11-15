import { createFileRoute, notFound } from '@tanstack/react-router';
import { checkGameAccess } from '@/lib/player.functions';
import { accountQuery } from '@/lib/account-query';
import { slots } from '@/lib/slots';
import { pageHead } from '@/lib/metadata';
import { SlotGame } from '@/components/player/slot-game';
export const Route = createFileRoute('/_authenticated/game/$gameId')({
  head: ({ params }) => pageHead(slots.find(s => s.id === params.gameId)?.name ?? 'Game', 'Obsidian Slots full-screen game.'),
  loader: async ({ params, context }) => {
    if (!slots.some(s => s.id === params.gameId)) throw notFound();
    await Promise.all([checkGameAccess(), context.queryClient.ensureQueryData(accountQuery)]);
  },
  component: Game,
});
function Game() {
  const { gameId } = Route.useParams();
  const game = slots.find(s => s.id === gameId);
  if (!game) return null;
  return <SlotGame gameId={game.id} gameName={game.name} />;
}