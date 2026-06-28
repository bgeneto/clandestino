type PublicTabsProps = {
  active: 'standings' | 'groups' | 'matches';
  onChange: (tab: 'standings' | 'groups' | 'matches') => void;
};

const tabs = [
  { id: 'standings' as const, label: 'Classificação' },
  { id: 'groups' as const, label: 'Grupos' },
  { id: 'matches' as const, label: 'Partidas' },
];

export function PublicTabs({ active, onChange }: PublicTabsProps) {
  return (
    <div className="flex border-b border-line bg-card">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            'flex-1 py-3 text-sm transition',
            active === tab.id
              ? 'border-b-2 border-foreground font-bold text-foreground'
              : 'text-subtle',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
