type ScoreCounterProps = {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
};

export function ScoreCounter({
  label,
  value,
  onIncrement,
  onDecrement,
  max = 3,
}: ScoreCounterProps) {
  const btnClass =
    'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-foreground text-foreground disabled:opacity-30 sm:h-10 sm:w-10';

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <p className="mb-2 max-w-full truncate px-1 text-xs font-semibold text-foreground sm:mb-3 sm:text-sm">
        {label}
      </p>
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          aria-label={`Diminuir sets de ${label}`}
          onClick={onDecrement}
          disabled={value <= 0}
          className={btnClass}
        >
          <svg viewBox="0 0 14 14" className="size-3 sm:size-3.5" aria-hidden>
            <path d="M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="min-w-8 text-3xl font-bold text-foreground sm:min-w-10 sm:text-4xl">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Aumentar sets de ${label}`}
          onClick={onIncrement}
          disabled={value >= max}
          className={btnClass}
        >
          <svg viewBox="0 0 14 14" className="size-3 sm:size-3.5" aria-hidden>
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
