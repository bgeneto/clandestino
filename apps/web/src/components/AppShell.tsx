import type { ReactNode } from 'react';
import { ConnectionStatus } from './ConnectionStatus.js';
import { useOfflineSync } from '../offline/register-sw.js';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  useOfflineSync();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">FitPong</p>
            <h1 className="text-lg font-semibold text-white">Clandestino</h1>
          </div>
          <ConnectionStatus />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  );
}
