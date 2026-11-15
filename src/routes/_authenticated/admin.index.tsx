import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpenCheck, Users, WalletCards } from 'lucide-react';
import { getAdminOverview } from '@/lib/admin.functions';
import { adminAccessQuery } from '@/lib/admin-query';
import { ErrorPanel, LoadingPanel, PageHeader, StatCard } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin/')({
  head: () => adminHead('Visão geral', 'Resumo operacional de jogadores, KYC, apostas e saques.'),
  component: AdminOverview,
});
function AdminOverview() {
  const access = useQuery(adminAccessQuery);
  const query = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => getAdminOverview() });
  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const data = query.data!;
  const canKyc = access.data?.roles.some((role) => ['admin', 'support'].includes(role));
  return <><PageHeader title="Visão geral" description="Acompanhe os pontos que precisam de ação da equipe hoje." /><section className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Jogadores" value={data.players} detail="contas cadastradas" /><StatCard label="KYC pendente" value={data.pendingKyc} detail="aguardando análise" /><StatCard label="Saques solicitados" value={data.requestedWithdrawals ?? '—'} detail={data.requestedWithdrawals === null ? 'acesso financeiro necessário' : 'aguardando financeiro'} /><StatCard label="Apostas · 24h" value={data.bets24h} detail="volume de rodadas" /></section><section className="mt-8 grid gap-4 md:grid-cols-3">{canKyc && <Link to="/admin/kyc" className="group border border-border bg-card p-6 transition-colors hover:bg-accent"><BookOpenCheck className="mb-8 h-6 w-6 text-muted-foreground" /><div className="flex items-center justify-between"><div><h2 className="font-semibold">Revisar identidades</h2><p className="mt-1 text-sm text-muted-foreground">Documentos e aprovação de carteira</p></div><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div></Link>}<Link to="/admin/players" className="group border border-border bg-card p-6 transition-colors hover:bg-accent"><Users className="mb-8 h-6 w-6 text-muted-foreground" /><div className="flex items-center justify-between"><div><h2 className="font-semibold">Encontrar jogador</h2><p className="mt-1 text-sm text-muted-foreground">Saldo, apostas e relacionamento</p></div><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div></Link>{data.requestedWithdrawals !== null && <Link to="/admin/withdrawals" className="group border border-border bg-card p-6 transition-colors hover:bg-accent"><WalletCards className="mb-8 h-6 w-6 text-muted-foreground" /><div className="flex items-center justify-between"><div><h2 className="font-semibold">Processar saques</h2><p className="mt-1 text-sm text-muted-foreground">Aprovação e confirmação de pagamento</p></div><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div></Link>}</section></>;
}
