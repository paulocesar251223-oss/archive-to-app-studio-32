import type { ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { adminErrorMessage } from '@/lib/admin-rules';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow ?? 'SOCHI Operations'}</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}
export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <Card className="rounded-none border-border bg-card shadow-none"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-3 font-mono text-3xl font-semibold tabular-nums">{value}</p>{detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>;
}
export function LoadingPanel({ label = 'Carregando dados…' }: { label?: string }) {
  return <div role="status" className="flex min-h-40 items-center justify-center gap-3 border border-border text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</div>;
}
export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div role="alert" className="flex min-h-32 flex-col items-center justify-center gap-3 border border-destructive/40 p-6 text-center"><AlertCircle className="h-5 w-5 text-destructive" /><p className="max-w-xl text-sm text-destructive">{adminErrorMessage(error)}</p>{retry && <Button variant="outline" size="sm" onClick={retry}>Tentar novamente</Button>}</div>;
}
export function EmptyPanel({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-border p-6 text-center"><Inbox className="mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}
export function StatusBadge({ status }: { status: string }) {
  const destructive = ['blocked', 'rejected'].includes(status);
  const positive = ['approved', 'paid', 'active'].includes(status);
  return <Badge variant={destructive ? 'destructive' : positive ? 'default' : 'secondary'} className="rounded-sm font-mono text-[10px] uppercase tracking-wider">{status}</Badge>;
}
export function PaginationControls({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{total} registros · página {page} de {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</Button></div></div>;
}
export function money(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0));
}
export function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
export function shortAddress(value: string | null | undefined) {
  return value ? `${value.slice(0, 6)}…${value.slice(-5)}` : '—';
}
