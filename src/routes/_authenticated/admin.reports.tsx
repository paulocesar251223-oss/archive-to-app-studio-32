import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getAdminReports } from '@/lib/admin.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeader, StatCard, money } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin/reports')({
  head: () => adminHead('Relatórios', 'Receita, depósitos, saques, volume por jogo e jogadores ativos.'),
  component: Reports,
});
function day(offset: number) { const value = new Date(); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); }
function Reports() {
  const [fromInput, setFromInput] = useState(day(-29)); const [toInput, setToInput] = useState(day(0));
  const [range, setRange] = useState({ from: `${day(-29)}T00:00:00.000Z`, to: `${day(1)}T00:00:00.000Z` });
  const query = useQuery({ queryKey: ['admin', 'reports', range], queryFn: () => getAdminReports({ data: range }) });
  function apply(event: FormEvent) { event.preventDefault(); const end = new Date(`${toInput}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1); setRange({ from: `${fromInput}T00:00:00.000Z`, to: end.toISOString() }); }
  return <><PageHeader title="Relatórios" description="Receita = apostas menos prêmios no período. Saques consideram pagamentos confirmados." /><form onSubmit={apply} className="mb-8 flex flex-col items-end gap-3 sm:flex-row"><div className="w-full sm:w-auto"><Label>De</Label><Input className="mt-2" type="date" required value={fromInput} onChange={(event) => setFromInput(event.target.value)} /></div><div className="w-full sm:w-auto"><Label>Até</Label><Input className="mt-2" type="date" required value={toInput} onChange={(event) => setToInput(event.target.value)} /></div><Button>Atualizar relatório</Button></form>{query.isLoading ? <LoadingPanel /> : query.error ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : query.data && <><section className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Receita" value={money(query.data.revenue)} /><StatCard label="Depósitos" value={money(query.data.deposits)} /><StatCard label="Saques pagos" value={money(query.data.withdrawals)} /><StatCard label="Volume apostado" value={money(query.data.bet_volume)} /><StatCard label="Jogadores ativos" value={query.data.active_players} /></section><section className="mt-8"><h2 className="mb-4 text-xl font-semibold">Volume por jogo</h2>{!query.data.games.length ? <EmptyPanel title="Sem apostas no período" description="Escolha outro intervalo para ver o volume." /> : <div className="border border-border"><Table><TableHeader><TableRow><TableHead>Jogo</TableHead><TableHead>Rodadas</TableHead><TableHead>Volume</TableHead></TableRow></TableHeader><TableBody>{query.data.games.map((game) => <TableRow key={game.game}><TableCell className="font-mono">{game.game}</TableCell><TableCell>{game.bets}</TableCell><TableCell>{money(game.volume)}</TableCell></TableRow>)}</TableBody></Table></div>}</section></>}</>;
}
