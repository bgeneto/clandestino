import { useEffect, useRef, useState } from 'react';
import type { NotificationItem } from '../../notifications/types.js';

const icons = {
  danger: '🚫',
  warning: '⚠️',
  success: '✅',
  info: '💡',
};

const surfaceClasses = {
  danger: 'border-danger-surface bg-danger-surface text-danger-foreground',
  warning: 'border-warning-surface bg-warning-surface text-warning-foreground',
  success: 'border-success-surface bg-success-surface text-success-foreground',
  info: 'border-info-surface bg-info-surface text-info-foreground',
};

const progressClasses = {
  danger: 'bg-danger-foreground/80',
  warning: 'bg-warning-foreground/80',
  success: 'bg-success-foreground/80',
  info: 'bg-info-foreground/80',
};

type NotificationProps = {
  item: NotificationItem;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
};

function elapsedMs(item: NotificationItem, now: number): number {
  if (item.pausedAt !== null) {
    return item.pausedAt - item.createdAt - item.elapsedWhilePaused;
  }

  return now - item.createdAt - item.elapsedWhilePaused;
}

export function Notification({ item, onDismiss, onPause, onResume }: NotificationProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const hoverPauseEnabledRef = useRef(false);
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    Math.max(1, Math.ceil(item.duration / 1000)),
  );

  useEffect(() => {
    const enableHoverPause = window.setTimeout(() => {
      hoverPauseEnabledRef.current = true;
    }, 400);

    return () => {
      window.clearTimeout(enableHoverPause);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsed = elapsedMs(item, now);
      const remaining = Math.max(0, item.duration - elapsed);
      const progress = remaining / item.duration;

      if (barRef.current) {
        barRef.current.style.width = `${progress * 100}%`;
      }

      const nextSeconds = Math.max(1, Math.ceil(remaining / 1000));
      setSecondsRemaining((current) => (current === nextSeconds ? current : nextSeconds));

      if (remaining <= 0) {
        onDismiss(item.id);
        return;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [item, onDismiss]);

  const role = item.variant === 'danger' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={`relative overflow-hidden rounded-2xl border shadow-lg backdrop-blur ${surfaceClasses[item.variant]}`}
      onMouseEnter={() => {
        if (hoverPauseEnabledRef.current) {
          onPause(item.id);
        }
      }}
      onMouseLeave={() => onResume(item.id)}
      onFocus={() => onPause(item.id)}
      onBlur={() => onResume(item.id)}
    >
      <div className="flex items-start gap-3 p-4 pr-3 text-sm">
        <span aria-hidden="true" className="mt-0.5 text-base">
          {icons[item.variant]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.message}</p>
          {item.description ? <p className="mt-1 text-xs opacity-90">{item.description}</p> : null}
        </div>
        <button
          type="button"
          aria-label="Fechar"
          className="rounded-md px-2 py-1 text-base leading-none opacity-70 transition hover:opacity-100"
          onClick={() => onDismiss(item.id)}
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/15">
          <div
            ref={barRef}
            className={`h-full rounded-full ${progressClasses[item.variant]}`}
            style={{ width: '100%' }}
          />
        </div>
        <span className="text-[10px] tabular-nums opacity-70" aria-hidden="true">
          {secondsRemaining}s
        </span>
      </div>
    </div>
  );
}
