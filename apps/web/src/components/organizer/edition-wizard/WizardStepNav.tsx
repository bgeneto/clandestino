const STEP_LABELS = ['Check-in', 'Grupos', 'Seeds', 'Sorteio', 'Publicar'] as const;

type WizardStepNavProps = {
  currentStep: number;
};

export function WizardStepNav({ currentStep }: WizardStepNavProps) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STEP_LABELS.map((label, index) => {
        const stepNumber = index + 2;
        const active = currentStep === stepNumber;
        const completed = currentStep > stepNumber;

        return (
          <li
            key={label}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium',
              active
                ? 'bg-brand text-white'
                : completed
                  ? 'bg-card-muted text-foreground'
                  : 'bg-card-muted text-subtle',
            ].join(' ')}
          >
            {stepNumber}. {label}
          </li>
        );
      })}
    </ol>
  );
}
