import { useOnlineStatus } from '../hooks/use-online-status.js';
import { useOutboxCount } from '../hooks/use-outbox-count.js';

export function ConnectionStatus() {
  const online = useOnlineStatus();
  const pendingCount = useOutboxCount();

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="inline-flex items-center gap-2 rounded-full border border-header-foreground/20 bg-header-foreground/10 px-3 py-1">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`}
        />
        <span>{online ? 'Online' : 'Offline'}</span>
      </span>

      {pendingCount > 0 ? (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-warning-surface bg-warning-surface px-3 py-1 text-warning-foreground"
          title={`${pendingCount} item(ns) aguardando sincronização`}
        >
          <span aria-hidden="true">📶</span>
          <span>{pendingCount} na fila</span>
        </span>
      ) : null}
    </div>
  );
}
