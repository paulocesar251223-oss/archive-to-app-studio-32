import { Link } from '@tanstack/react-router';
import { Diamond, Gamepad2, Settings, Wallet } from 'lucide-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { accountQuery } from '@/lib/account-query';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { CenterTabIcon } from './center-tab-icon';
export function PlayerShell({ children }: { children: ReactNode }) {
 const { data } = useSuspenseQuery(accountQuery); const { t, lang } = useI18n();
 return <div className="player-shell bg-background text-foreground"><header className="player-header"><Link to="/dashboard" aria-label={t.appName} className="flex items-center gap-2"><Diamond className="size-5"/><span className="hidden text-sm font-semibold sm:inline">OBSIDIAN</span></Link><div className="text-center"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.balance}</p><p className="text-lg font-semibold tabular-nums">{new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.balance)}</p></div><Button variant="ghost" size="icon" asChild><Link to="/settings" aria-label={t.settings} title={t.settings}><Settings/></Link></Button></header><main className="player-main">{children}</main><nav className="player-nav" aria-label={t.navigation}><Button variant="ghost" asChild className="h-14 flex-col gap-1"><Link to="/dashboard" activeProps={{ className: 'text-foreground' }} inactiveProps={{ className: 'text-muted-foreground' }}><Gamepad2/><span className="text-[10px]">{t.games}</span></Link></Button><Button variant="ghost" asChild className="h-14"><Link to="/rewards" aria-label={t.centerTab} activeProps={{ className: 'text-foreground' }} inactiveProps={{ className: 'text-muted-foreground' }}><CenterTabIcon/></Link></Button><Button variant="ghost" asChild className="h-14 flex-col gap-1"><Link to="/wallet" search={{}} activeProps={{ className: 'text-foreground' }} inactiveProps={{ className: 'text-muted-foreground' }}><Wallet/><span className="text-[10px]">{t.walletProfile}</span></Link></Button></nav></div>;
}