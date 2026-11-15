import { useState, type FormEvent } from 'react';
import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search } from 'lucide-react';
import { listAdminPlayers } from '@/lib/admin.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeader, PaginationControls, StatusBadge, dateTime, shortAddress } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin/players')({
  head: () => adminHead('Jogadores', 'Consulte contas, status, Telegram e carteiras dos jogadores.'),
  component: Players,
});
function Players() {
  const isIndex = useMatches({ select: (matches) => matches.at(-1)?.routeId === Route.id });
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'all' as 'all' | 'pending' | 'approved' | 'rejected' | 'blocked', page: 1 });
  const query = useQuery({ queryKey: ['admin', 'players', filters], queryFn: () => listAdminPlayers({ data: { ...filters, pageSize: 20 } }), enabled: isIndex });
  function apply(event: FormEvent) { event.preventDefault(); setFilters({ search: searchInput.trim(), status: filters.status, page: 1 }); }
  if (!isIndex) return <Outlet />;
  return <><PageHeader title="Jogadores" description="Localize uma conta para abrir histórico de apostas, finanças, conquistas e indicações." /><form onSubmit={apply} className="mb-6 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar jogador" className="pl-10" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nome ou e-mail" /></div><select aria-label="Filtrar status" className="border border-input bg-background px-3 text-sm" value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value as typeof filters.status, page: 1 }))}><option value="all">Todos os status</option><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="rejected">Rejeitado</option><option value="blocked">Bloqueado</option></select><Button type="submit">Buscar</Button></form>{query.isLoading ? <LoadingPanel /> : query.error ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : !query.data?.rows.length ? <EmptyPanel title="Nenhum jogador encontrado" description="Ajuste a busca ou o filtro de status." /> : <><div className="border border-border"><Table><TableHeader><TableRow><TableHead>Jogador</TableHead><TableHead>Status</TableHead><TableHead>Telegram</TableHead><TableHead>Carteira</TableHead><TableHead>Cadastro</TableHead><TableHead><span className="sr-only">Abrir</span></TableHead></TableRow></TableHeader><TableBody>{query.data.rows.map((player) => <TableRow key={player.user_id}><TableCell><p className="font-medium">{player.full_name || 'Sem nome verificado'}</p><p className="text-xs text-muted-foreground">{player.email}</p></TableCell><TableCell><StatusBadge status={player.status} /></TableCell><TableCell className="font-mono text-xs">{player.telegram_id ?? '—'}</TableCell><TableCell className="font-mono text-xs">{shortAddress(player.solana_wallet_address)}</TableCell><TableCell className="text-xs text-muted-foreground">{dateTime(player.created_at)}</TableCell><TableCell><Button variant="ghost" size="icon" asChild><Link to="/admin/players/$playerId" params={{ playerId: player.user_id }} aria-label={`Abrir ${player.email}`}><ArrowRight className="h-4 w-4" /></Link></Button></TableCell></TableRow>)}</TableBody></Table></div><PaginationControls page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={(page) => setFilters((old) => ({ ...old, page }))} /></>}</>;
}
