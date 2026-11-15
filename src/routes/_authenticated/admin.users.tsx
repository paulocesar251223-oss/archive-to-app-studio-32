import { useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Search, Send } from 'lucide-react';
import { allowTelegramRelink, listAdminPlayers, setUserBlocked } from '@/lib/admin.functions';
import { adminAccessQuery } from '@/lib/admin-query';
import { adminErrorMessage } from '@/lib/admin-rules';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeader, PaginationControls, StatusBadge } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin/users')({
  head: () => adminHead('Gestão de usuários', 'Bloqueie contas e autorize a troca de vínculo do Telegram.'),
  component: Users,
});
type Player = { user_id: string; email: string | null; full_name: string | null; status: 'pending' | 'approved' | 'rejected' | 'blocked'; telegram_id: number | null; telegram_relink_allowed: boolean };
function Users() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [blockTarget, setBlockTarget] = useState<{ user: Player; blocked: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const access = useQuery(adminAccessQuery);
  const block = useServerFn(setUserBlocked);
  const relink = useServerFn(allowTelegramRelink);
  const isAdmin = access.data?.roles.includes('admin') ?? false;
  const query = useQuery({ queryKey: ['admin', 'users', search, page], queryFn: () => listAdminPlayers({ data: { search, status: 'all', page, pageSize: 20 } }) });
  const blockMutation = useMutation({
    mutationFn: () => block({ data: { userId: blockTarget!.user.user_id, blocked: blockTarget!.blocked, reason } }),
    onSuccess: async () => { setBlockTarget(null); setReason(''); await refresh(); },
  });
  const relinkMutation = useMutation({
    mutationFn: ({ userId, allowed }: { userId: string; allowed: boolean }) => relink({ data: { userId, allowed } }),
    onSuccess: refresh,
  });
  async function refresh() { await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'users'] }), client.invalidateQueries({ queryKey: ['admin', 'players'] }), client.invalidateQueries({ queryKey: ['admin', 'player'] }), client.invalidateQueries({ queryKey: ['admin', 'audit'] })]); }
  function apply(event: FormEvent) { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }
  const actionError = blockMutation.error || relinkMutation.error;
  return <><PageHeader title="Gestão de usuários" description="Bloqueios exigem motivo. A troca de Telegram só é liberada quando a equipe autoriza explicitamente." /><form onSubmit={apply} className="mb-6 flex gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar usuário" className="pl-10" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nome ou e-mail" /></div><Button>Buscar</Button></form>{actionError && <p role="alert" className="mb-4 border border-destructive/40 p-3 text-sm text-destructive">{adminErrorMessage(actionError)}</p>}{query.isLoading ? <LoadingPanel /> : query.error ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : !query.data?.rows.length ? <EmptyPanel title="Nenhum usuário" description="Tente outro nome ou e-mail." /> : <><div className="border border-border"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Status</TableHead><TableHead>Telegram</TableHead><TableHead>Troca de vínculo</TableHead><TableHead>Conta</TableHead></TableRow></TableHeader><TableBody>{query.data.rows.map((user) => <TableRow key={user.user_id}><TableCell><Link to="/admin/players/$playerId" params={{ playerId: user.user_id }} className="font-medium hover:underline">{user.full_name || 'Sem nome verificado'}</Link><p className="text-xs text-muted-foreground">{user.email}</p></TableCell><TableCell><StatusBadge status={user.status} /></TableCell><TableCell className="font-mono text-xs">{user.telegram_id ?? 'Não vinculado'}</TableCell><TableCell><Button variant="outline" size="sm" disabled={relinkMutation.isPending} onClick={() => relinkMutation.mutate({ userId: user.user_id, allowed: !user.telegram_relink_allowed })}><Send className="h-3.5 w-3.5" />{user.telegram_relink_allowed ? 'Revogar autorização' : 'Autorizar troca'}</Button></TableCell><TableCell>{isAdmin && <Button variant={user.status === 'blocked' ? 'default' : 'destructive'} size="sm" onClick={() => { setBlockTarget({ user, blocked: user.status !== 'blocked' }); setReason(''); blockMutation.reset(); }}>{user.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}</Button>}</TableCell></TableRow>)}</TableBody></Table></div><PaginationControls page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} /></>}<Dialog open={Boolean(blockTarget)} onOpenChange={(open) => { if (!open && !blockMutation.isPending) setBlockTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{blockTarget?.blocked ? 'Bloquear usuário' : 'Desbloquear usuário'}</DialogTitle><DialogDescription>{blockTarget?.blocked ? 'A conta ficará impedida de usar a área do jogador. O status anterior será preservado.' : 'A conta voltará ao status que tinha antes do bloqueio.'}</DialogDescription></DialogHeader><div><Label htmlFor="block-reason">Motivo obrigatório</Label><Textarea id="block-reason" className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} /></div>{blockMutation.error && <p role="alert" className="text-sm text-destructive">{adminErrorMessage(blockMutation.error)}</p>}<DialogFooter><Button variant="outline" onClick={() => setBlockTarget(null)}>Cancelar</Button><Button variant={blockTarget?.blocked ? 'destructive' : 'default'} disabled={blockMutation.isPending || reason.trim().length < 3} onClick={() => blockMutation.mutate()}>{blockMutation.isPending ? 'Salvando…' : 'Confirmar'}</Button></DialogFooter></DialogContent></Dialog></>;
}
