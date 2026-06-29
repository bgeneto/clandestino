import type { ReactNode } from 'react';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

const icons: Record<ConfirmDialogVariant, string> = {
  danger: '🗑️',
  warning: '⚠️',
  info: '💡',
};

const titleClasses: Record<ConfirmDialogVariant, string> = {
  danger: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-brand dark:text-brand',
};

const confirmClasses: Record<ConfirmDialogVariant, string> = {
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 dark:bg-rose-500 dark:hover:bg-rose-600',
  warning:
    'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500 dark:bg-amber-500 dark:hover:bg-amber-600',
  info: 'bg-brand text-white hover:bg-brand/90 focus:ring-brand',
};

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-muted text-lg"
            aria-hidden="true"
          >
            {icons[variant]}
          </span>
          <div className="flex-1">
            <h3
              id="confirm-dialog-title"
              className={`text-lg font-semibold ${titleClasses[variant]}`}
            >
              {title}
            </h3>
            <div className="mt-2 text-sm text-muted">{description}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="w-full rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-card-muted disabled:opacity-50 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 sm:w-auto ${confirmClasses[variant]}`}
          >
            {isLoading ? 'Processando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
