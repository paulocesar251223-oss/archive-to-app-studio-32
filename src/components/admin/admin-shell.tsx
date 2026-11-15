import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, BookOpenCheck, CircleDollarSign, Diamond, FileClock, LayoutDashboard, LogOut, Settings, ShieldCheck, Users, UserSearch, WalletCards } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS, type StaffRole } from '@/lib/admin-rules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const NAV_ITEMS: Array<{ to: string; label: string; icon: typeof LayoutDashboard; roles: StaffRole[]; exact?: boolean }> = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, roles: ['admin', 'finance', 'support'], exact: true },
  { to: '/admin/kyc', label: 'Aprovação KYC', icon: BookOpenCheck, roles: ['admin', 'support'] },
  { to: '/admin/players', label: 'Jogadores', icon: UserSearch, roles: ['admin', 'finance', 'support'] },
  { to: '/admin/withdrawals', label: 'Saques', icon: WalletCards, roles: ['admin', 'finance'] },
  { to: '/admin/users', label: 'Usuários', icon: Users, roles: ['admin', 'support'] },
  { to: '/admin/reports', label: 'Relatórios', icon: Activity, roles: ['admin', 'finance'] },
  { to: '/admin/settings', label: 'Configurações', icon: Settings, roles: ['admin'] },
  { to: '/admin/audit', label: 'Auditoria', icon: FileClock, roles: ['admin'] },
];

export function AdminShell({ children, roles, email }: { children: ReactNode; roles: StaffRole[]; email: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.some((role) => roles.includes(role)));
  async function signOut() {
    await queryClient.cancelQueries(); queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: '/auth', replace: true });
  }
  return <div className="min-h-screen bg-background text-foreground"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex"><Link to="/admin" className="flex h-20 items-center gap-3 border-b border-border px-6 font-semibold"><Diamond className="h-5 w-5" /><span>OBSIDIAN <span className="font-normal text-muted-foreground">OPS</span></span></Link><nav aria-label="Administração" className="flex-1 space-y-1 overflow-y-auto p-4">{visibleItems.map((item) => <Link key={item.to} to={item.to} activeOptions={{ exact: Boolean(item.exact) }} activeProps={{ className: 'bg-accent text-accent-foreground' }} className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"><item.icon className="h-4 w-4" />{item.label}</Link>)}</nav><div className="border-t border-border p-4"><div className="mb-4 flex flex-wrap gap-1">{roles.map((role) => <Badge key={role} variant="outline" className="rounded-sm text-[10px]">{ROLE_LABELS[role]}</Badge>)}</div><p className="truncate text-xs text-muted-foreground" title={email}>{email}</p><Button variant="ghost" size="sm" className="mt-3 w-full justify-start px-0" onClick={signOut}><LogOut className="h-4 w-4" />Sair</Button></div></aside><div className="lg:pl-64"><header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur lg:hidden"><div className="flex h-16 items-center justify-between px-4"><Link to="/admin" className="flex items-center gap-2 font-semibold"><Diamond className="h-5 w-5" />OBSIDIAN OPS</Link><Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button></div><nav aria-label="Administração" className="flex gap-1 overflow-x-auto px-3 pb-3">{visibleItems.map((item) => <Link key={item.to} to={item.to} activeOptions={{ exact: Boolean(item.exact) }} activeProps={{ className: 'bg-accent text-accent-foreground' }} className="flex shrink-0 items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><item.icon className="h-3.5 w-3.5" />{item.label}</Link>)}</nav></header><main className="mx-auto max-w-[1500px] p-4 py-8 sm:p-8 lg:p-10">{children}</main><footer className="mx-auto flex max-w-[1500px] items-center gap-2 border-t border-border px-8 py-5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Acesso privilegiado · todas as alterações são auditadas<CircleDollarSign className="ml-auto h-3.5 w-3.5" /></footer></div></div>;
}
