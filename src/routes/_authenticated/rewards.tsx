import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { accountQuery } from '@/lib/account-query';
import { PlayerShell } from '@/components/player/player-shell';
import { pageHead } from '@/lib/metadata';
import { useI18n } from '@/i18n';
export const Route = createFileRoute('/_authenticated/rewards')({ head: () => pageHead('Rewards', 'Obsidian Slots player rewards.'), loader: ({ context }) => context.queryClient.ensureQueryData(accountQuery), component: Rewards });
function Rewards() { const { data } = useSuspenseQuery(accountQuery); const { t } = useI18n(); if (data.profile.status !== 'approved') return <Navigate to="/dashboard"/>; return <PlayerShell><h1 className="px-6 py-10 text-2xl font-semibold">{t.centerTab}</h1></PlayerShell>; }