import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { listAdminWithdrawals, reviewWithdrawal } from '@/lib/admin.functions';
import { adminErrorMessage } from '@/lib/admin-rules';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeader, PaginationControls, StatusBadge, dateTime, money, shortAddress } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin/withdrawals')({
  head: () => adminHead('Gestão de saques', 'Aprove, pague ou rejeite saques com saldo reservado.'),
  component: Withdrawals,
});
type Action = { id: string; decision: 'approve' | 'reject' | 'pay' } | null;
function Withdrawals() {
  const [status, setStatus] = useState<'all' | 'requested' | 'approved' | 'paid' | 'rejected'>('requested');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [txHash, setTxHash] = useState('');
  const client = useQueryClient();
  const review = useServerFn(reviewWithdrawal);
  const query = useQuery({ queryKey: ['admin', 'withdrawals', status, page], queryFn: () => listAdminWithdrawals({ data: { status, page } }) });
  const mutation = useMutation({
    mutationFn: () => review({ data: { withdrawalId: action!.id, decision: action!.decision, reason, txHash } }),
    onSuccess: async () => {
      setAction(null); setReason(''); setTxHash('');
      await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'withdrawals'] }), client.invalidateQueries({ queryKey: ['admin', 'overview'] }), client.invalidateQueries({ queryKey: ['admin', 'player'] }), client.invalidateQueries({ queryKey: ['admin', 'audit'] })]);
    },
  });
  function open(id: string, decision: 'approve' | 'reject' | 'pay') { setAction({ id, decision }); setReason(''); setTxHash(''); mutation.reset(); }
  return <><PageHeader title="Gestão de saques" description="O valor é debitado e reservado na solicitação. A aprovação não debita novamente; a rejeição devolve a reserva." /><div className="mb-6 flex flex-wrap gap-2">{(['requested', 'approved', 'paid', 'rejected', 'all'] as const).map((value) => <Button key={value} variant={status === value ? 'default' : 'outline'} size="sm" onClick={() => { setStatus(value); setPage(1); }}>{value === 'all' ? 'Todos' : value}</Button>)}</div>{query.isLoading ? <LoadingPanel /> : query.error ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : !query.data?.rows.length ? <EmptyPanel title="Nenhum saque neste status" description="Altere o filtro para consultar outras etapas." /> : <><div className="border border-border"><Table><TableHeader><TableRow><TableHead>Jogador</TableHead><TableHead>Valor</TableHead><TableHead>Destino</TableHead><TableHead>Status</TableHead><TableHead>Solicitado</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{query.data.rows.map((item) => <TableRow key={item.id}><TableCell><Link to="/admin/players/$playerId" params={{ playerId: item.user_id }} className="font-medium hover:underline">{item.player?.full_name || item.player?.email || item.user_id}</Link><p className="text-xs text-muted-foreground">{item.player?.email}</p></TableCell><TableCell className="font-mono">{money(item.amount)}</TableCell><TableCell className="font-mono text-xs" title={item.destination_address}>{shortAddress(item.destination_address)}</TableCell><TableCell><StatusBadge status={item.status} />{item.tx_hash && <p className="mt-1 max-w-28 truncate font-mono text-[10px]" title={item.tx_hash}>{item.tx_hash}</p>}</TableCell><TableCell className="text-xs">{dateTime(item.created_at)}</TableCell><TableCell><div className="flex flex-wrap gap-2">{item.status === 'requested' && <><Button size="sm" onClick={() => open(item.id, 'approve')}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => open(item.id, 'reject')}>Rejeitar</Button></>}{item.status === 'approved' && <><Button size="sm" onClick={() => open(item.id, 'pay')}>Marcar pago</Button><Button size="sm" variant="outline" onClick={() => open(item.id, 'reject')}>Rejeitar</Button></>}</div></TableCell></TableRow>)}</TableBody></Table></div><PaginationControls page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} /></>}<Dialog open={Boolean(action)} onOpenChange={(openState) => { if (!openState && !mutation.isPending) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{action?.decision === 'approve' ? 'Aprovar saque' : action?.decision === 'pay' ? 'Confirmar pagamento' : 'Rejeitar saque'}</DialogTitle><DialogDescription>{action?.decision === 'pay' ? 'Informe a assinatura da transação Solana. O saldo já está reservado e não será debitado novamente.' : action?.decision === 'reject' ? 'O motivo será registrado e o valor reservado voltará ao saldo.' : 'Confirme que a solicitação está apta para pagamento.'}</DialogDescription></DialogHeader>{action?.decision === 'reject' && <div><Label htmlFor="withdrawal-reason">Motivo obrigatório</Label><Textarea id="withdrawal-reason" className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} /></div>}{action?.decision === 'pay' && <div><Label htmlFor="payment-hash">Hash da transação</Label><Input id="payment-hash" className="mt-2 font-mono text-xs" value={txHash} onChange={(event) => setTxHash(event.target.value.trim())} /></div>}{mutation.error && <p role="alert" className="text-sm text-destructive">{adminErrorMessage(mutation.error)}</p>}<DialogFooter><Button variant="outline" onClick={() => setAction(null)} disabled={mutation.isPending}>Cancelar</Button><Button disabled={mutation.isPending || (action?.decision === 'reject' && reason.trim().length < 3) || (action?.decision === 'pay' && txHash.length < 64)} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Salvando…' : 'Confirmar'}</Button></DialogFooter></DialogContent></Dialog></>;
}
