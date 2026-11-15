import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getAdminAudit } from '@/lib/admin.functions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeader, dateTime } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin/audit')({
  head: () => adminHead('Auditoria', 'Histórico imutável das ações administrativas e financeiras.'),
  component: Audit,
});
function Audit() {
  const query = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => getAdminAudit() });
  return <><PageHeader title="Auditoria" description="As 200 ações mais recentes. O registro é imutável e não pode ser editado ou apagado pelo painel." />{query.isLoading ? <LoadingPanel /> : query.error ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : !query.data?.length ? <EmptyPanel title="Sem eventos" description="As ações da equipe aparecerão aqui." /> : <div className="border border-border"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Responsável</TableHead><TableHead>Alvo</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader><TableBody>{query.data.map((entry) => <TableRow key={entry.id}><TableCell className="whitespace-nowrap text-xs">{dateTime(entry.created_at)}</TableCell><TableCell className="font-mono text-xs">{entry.action}</TableCell><TableCell className="max-w-44 truncate font-mono text-xs" title={entry.actor_id ?? ''}>{entry.actor_id || 'Sistema'}</TableCell><TableCell><span className="font-mono text-xs">{entry.target_table}</span><p className="max-w-40 truncate text-[10px] text-muted-foreground" title={entry.target_id ?? ''}>{entry.target_id}</p></TableCell><TableCell className="max-w-80 truncate font-mono text-xs" title={JSON.stringify(entry.details)}>{JSON.stringify(entry.details)}</TableCell></TableRow>)}</TableBody></Table></div>}</>;
}
