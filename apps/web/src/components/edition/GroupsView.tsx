import type { GroupWithPlayers } from '@clandestino/shared-contracts';

type GroupsViewProps = {
  groups: GroupWithPlayers[];
  playerNames: Map<string, string>;
  highlightPlayerId?: string;
};

export function GroupsView({ groups, playerNames, highlightPlayerId }: GroupsViewProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">
        Grupos ainda não publicados.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((entry) => (
        <section key={entry.group.id} className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-[#1a1a2e]">
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
                    highlighted ? 'font-semibold text-[#1a1a2e]' : 'text-slate-700',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'h-2 w-2 rounded-full',
                      groupPlayer.isSeed ? 'bg-amber-400' : 'bg-slate-300',
                    ].join(' ')}
                  />
                  <span>{name}</span>
                  {groupPlayer.isSeed ? (
                    <span className="ml-auto text-[10px] font-bold uppercase text-slate-400">
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
