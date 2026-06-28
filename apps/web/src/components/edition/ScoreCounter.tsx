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
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <p className="mb-3 text-sm font-semibold text-foreground">{label}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Diminuir sets de ${label}`}
          onClick={onDecrement}
          disabled={value <= 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground text-xl font-bold text-foreground disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-10 text-4xl font-bold text-foreground">{value}</span>
        <button
          type="button"
          aria-label={`Aumentar sets de ${label}`}
          onClick={onIncrement}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground text-xl font-bold text-foreground disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
