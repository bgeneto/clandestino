import type { GroupWithPlayers } from '@clandestino/shared-contracts';

type GroupsViewProps = {
  groups: GroupWithPlayers[];
  playerNames: Map<string, string>;
  highlightPlayerId?: string;
};

export function GroupsView({ groups, playerNames, highlightPlayerId }: GroupsViewProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-subtle">
        Grupos ainda não publicados.
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
