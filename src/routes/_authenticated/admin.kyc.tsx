import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ExternalLink, FileCheck2, ShieldCheck } from 'lucide-react';
import { getKycDetails, getKycQueue, reviewKyc } from '@/lib/admin.functions';
import { adminErrorMessage } from '@/lib/admin-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeader, dateTime } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin/kyc')({
  head: () => adminHead('Aprovação de KYC', 'Revise documentos e aprove identidades com carteira Solana.'),
  component: KycQueue,
});
function KycQueue() {
  const [selected, setSelected] = useState<string | null>(null);
  const [wallet, setWallet] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const client = useQueryClient();
  const review = useServerFn(reviewKyc);
  const queue = useQuery({ queryKey: ['admin', 'kyc', 'queue'], queryFn: () => getKycQueue() });
  const details = useQuery({ queryKey: ['admin', 'kyc', selected], queryFn: () => getKycDetails({ data: { userId: selected! } }), enabled: Boolean(selected), staleTime: 4 * 60 * 1000 });
  const mutation = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => review({ data: { userId: selected!, decision, wallet, reason } }),
    onSuccess: async (_, decision) => {
      setMessage(decision === 'approve' ? 'KYC aprovado e carteira vinculada.' : 'KYC rejeitado com motivo registrado.');
      setSelected(null); setWallet(''); setReason('');
      await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'kyc'] }), client.invalidateQueries({ queryKey: ['admin', 'overview'] }), client.invalidateQueries({ queryKey: ['admin', 'audit'] })]);
    },
  });
  function choose(userId: string) { setSelected(userId); setWallet(''); setReason(''); setMessage(''); mutation.reset(); }
  return <><PageHeader title="Aprovação de KYC" description="Confira os dados e os documentos. Links de imagem expiram em 5 minutos; toda visualização fica auditada." /><div className="grid gap-6 xl:grid-cols-[360px_1fr]"><section><h2 className="mb-3 text-sm font-semibold">Fila de espera</h2>{queue.isLoading ? <LoadingPanel /> : queue.error ? <ErrorPanel error={queue.error} retry={() => void queue.refetch()} /> : !queue.data?.length ? <EmptyPanel title="Fila em dia" description="Nenhuma identidade aguardando análise." /> : <div className="divide-y divide-border border border-border">{queue.data.map((item) => <button key={item.user_id} onClick={() => choose(item.user_id)} className={`w-full p-4 text-left transition-colors hover:bg-accent ${selected === item.user_id ? 'bg-accent' : ''}`}><p className="font-medium">{item.full_name || 'Nome não informado'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.email}</p><p className="mt-2 text-xs text-muted-foreground">Enviado em {dateTime(item.kyc_submitted_at)}</p></button>)}</div>}{message && <p role="status" className="mt-4 border border-border p-3 text-sm">{message}</p>}</section><section>{!selected ? <EmptyPanel title="Selecione uma identidade" description="Os dados e documentos aparecerão aqui." /> : details.isLoading ? <LoadingPanel label="Gerando links temporários…" /> : details.error ? <ErrorPanel error={details.error} retry={() => void details.refetch()} /> : details.data && <div className="space-y-6"><div className="border border-border p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Titular</p><h2 className="mt-1 text-2xl font-semibold">{details.data.profile.full_name}</h2><p className="mt-1 text-sm text-muted-foreground">{details.data.profile.email}</p></div><ShieldCheck className="h-6 w-6" /></div><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Nacionalidade</dt><dd className="mt-1">{details.data.profile.nationality}</dd></div><div><dt className="text-muted-foreground">Documento</dt><dd className="mt-1 font-mono">{details.data.profile.document_number}</dd></div><div className="sm:col-span-2"><dt className="text-muted-foreground">Endereço</dt><dd className="mt-1">{details.data.profile.address}</dd></div></dl></div><div className="grid gap-4 md:grid-cols-2">{details.data.documents.map((file) => <article key={file.id} className="border border-border"><a href={file.signedUrl} target="_blank" rel="noreferrer" className="block bg-secondary"><img src={file.signedUrl} alt={`Documento ${file.kind}`} className="h-72 w-full object-contain" /></a><div className="flex items-center justify-between p-3 text-xs"><span className="font-mono">{file.kind}</span><a href={file.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Abrir<ExternalLink className="h-3 w-3" /></a></div></article>)}</div><div className="grid gap-5 border border-border p-5 lg:grid-cols-2"><div><div className="mb-4 flex items-center gap-2"><FileCheck2 className="h-4 w-4" /><h3 className="font-semibold">Aprovar identidade</h3></div><Label htmlFor="wallet">Carteira Solana criada para o usuário</Label><Input id="wallet" className="mt-2 font-mono text-xs" value={wallet} onChange={(event) => setWallet(event.target.value.trim())} placeholder="Endereço base58" /><Button className="mt-3 w-full" disabled={mutation.isPending || wallet.length < 32} onClick={() => mutation.mutate('approve')}>{mutation.isPending && mutation.variables === 'approve' ? 'Aprovando…' : 'Aprovar e vincular carteira'}</Button></div><div><h3 className="mb-4 font-semibold">Rejeitar envio</h3><Label htmlFor="reject-reason">Motivo obrigatório</Label><Textarea id="reject-reason" className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique o que precisa ser corrigido" /><Button variant="destructive" className="mt-3 w-full" disabled={mutation.isPending || reason.trim().length < 3} onClick={() => mutation.mutate('reject')}>{mutation.isPending && mutation.variables === 'reject' ? 'Rejeitando…' : 'Rejeitar KYC'}</Button></div>{mutation.error && <p role="alert" className="text-sm text-destructive lg:col-span-2">{adminErrorMessage(mutation.error)}</p>}</div></div>}</section></div></>;
}
