import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ConnectionStatus } from './ConnectionStatus.js';
import { NotificationProvider } from '../notifications/notification-context.js';
import { useOfflineSync } from '../offline/register-sw.js';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  useOfflineSync();

  return (
    <NotificationProvider>
      <div className="flex min-h-dvh flex-col bg-surface text-foreground">
        <header className="sticky top-0 z-10 border-b border-line bg-header/95 px-4 py-3 text-header-foreground backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-header-foreground/60">
                Tênis de Mesa
              </p>
              <Link to="/" className="text-lg font-semibold">
                Clandestino 🏓
              </Link>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ConnectionStatus />
              <Link
                className="text-[11px] text-header-foreground/50 underline-offset-2 hover:text-header-foreground/70 hover:underline"
                to="/organizador"
              >
                Organizador
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">{children}</main>
      </div>
    </NotificationProvider>
  );
}
