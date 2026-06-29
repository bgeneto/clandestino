import type { GroupWithPlayers } from '@clandestino/shared-contracts';

export type GroupsViewEmptyVariant = 'draw' | 'placement' | 'generic';

const EMPTY_MESSAGES: Record<GroupsViewEmptyVariant, string> = {
  draw: 'Sorteio ainda não publicado.',
  placement: 'Nenhum grupo de colocação.',
  generic: 'Grupos ainda não publicados.',
};

export function getGroupsViewEmptyMessage(variant: GroupsViewEmptyVariant = 'generic'): string {
  return EMPTY_MESSAGES[variant];
}

type GroupsViewProps = {
  groups: GroupWithPlayers[];
  playerNames: Map<string, string>;
  highlightPlayerId?: string;
  emptyVariant?: GroupsViewEmptyVariant;
};

export function GroupsView({
  groups,
  playerNames,
  highlightPlayerId,
  emptyVariant = 'generic',
}: GroupsViewProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-subtle">
        {getGroupsViewEmptyMessage(emptyVariant)}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((entry) => (
        <section key={entry.group.id} className="rounded-xl bg-card p-4 shadow-sm">
          <h3 className="border-b border-line pb-2 text-sm font-bold text-foreground">
            {entry.group.name}
          </h3>
          <ul className="mt-2 space-y-2">
            {entry.players.map((groupPlayer) => {
              const name = playerNames.get(groupPlayer.playerId) ?? 'Jogador';
              const highlighted = groupPlayer.playerId === highlightPlayerId;

              return (
                <li
                  key={groupPlayer.playerId}
                  className={[
                    'flex items-center gap-2 text-sm',
                    highlighted ? 'font-semibold text-foreground' : 'text-muted',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'h-2 w-2 rounded-full',
                      groupPlayer.isSeed ? 'bg-amber-400' : 'bg-surface-muted',
                    ].join(' ')}
                  />
                  <span>{name}</span>
                  {groupPlayer.isSeed ? (
                    <span className="ml-auto text-[10px] font-bold uppercase text-subtle">
                      SEED
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
