import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ShieldX } from 'lucide-react';
import { adminAccessQuery } from '@/lib/admin-query';
import { AdminShell } from '@/components/admin/admin-shell';
import { ErrorPanel, LoadingPanel } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/admin')({
  head: () => adminHead('Painel administrativo', 'Operações protegidas por papel.'),
  component: AdminLayout,
});

function AdminLayout() {
  const access = useQuery(adminAccessQuery);
  if (access.isLoading) return <div className="p-8"><LoadingPanel label="Verificando permissões…" /></div>;
  if (access.error) return <div className="p-8"><ErrorPanel error={access.error} retry={() => void access.refetch()} /></div>;
  if (!access.data?.staff) return <div className="flex min-h-screen items-center justify-center p-6"><div className="max-w-md text-center"><ShieldX className="mx-auto mb-5 h-10 w-10 text-destructive" /><h1 className="text-2xl font-semibold">Acesso restrito</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Esta conta não possui um papel administrativo. O acesso é validado no servidor.</p></div></div>;
  return <AdminShell roles={access.data.roles} email={access.data.email}><Outlet /></AdminShell>;
}
