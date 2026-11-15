import { Link } from '@tanstack/react-router';
import { Diamond, Settings, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

export function AccountShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return <div className="min-h-screen bg-background text-foreground"><header className="mx-auto flex max-w-6xl items-center justify-between border-b border-border px-6 py-6"><Link to="/" className="flex items-center gap-3 font-semibold"><Diamond className="h-6 w-6" />{t.appName}</Link><Button variant="ghost" size="icon" asChild><Link to="/settings" aria-label={t.settings} title={t.settings}><Settings className="h-5 w-5" /></Link></Button></header><main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">{children}</main><footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-border px-6 py-6 text-xs text-muted-foreground"><span>© {new Date().getFullYear()} {t.appName}</span><ShieldCheck className="h-4 w-4" /></footer></div>;
}