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

export function Alert({
  variant = 'info',
  children,
}: {
  variant?: 'danger' | 'warning' | 'success' | 'info';
  children: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 text-sm ${surfaceClasses[variant]}`}
    >
      <span aria-hidden="true" className="text-base">
        {icons[variant]}
      </span>
      <p>{children}</p>
    </div>
  );
}
