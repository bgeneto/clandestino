import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  validatePlayerName,
  findDuplicateNormalizedPlayerName,
  PLAYER_NAME_DUPLICATE_MESSAGE,
} from '@clandestino/shared-contracts';
import { useChampionship, useChampionshipRoster } from '../../hooks/use-organizer-data.js';
import { deletePlayer, updatePlayer } from '../../lib/organizer-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { Alert } from '../../components/ui/Alert.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { useNotification } from '../../notifications/notification-context.js';
import { notifyApiError } from '../../notifications/notify-api-error.js';

export function ChampionshipPlayersPage() {
  const { championshipId } = useParams<{ championshipId: string }>();
  const queryClient = useQueryClient();
  const notify = useNotification();
  const championshipQuery = useChampionship(championshipId);
  const rosterQuery = useChampionshipRoster(championshipId);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingError, setEditingError] = useState<string | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({ playerId, name }: { playerId: string; name: string }) => {
      return updatePlayer(playerId, { name });
    },
    onSuccess: async () => {
      setEditingPlayerId(null);
      setEditingName('');
      setEditingError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.championshipRoster(championshipId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.players() }),
      ]);
      notify.success('Jogador atualizado.');
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível atualizar o jogador.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (playerId: string) => {
      return deletePlayer(playerId);
    },
    onSuccess: async () => {
      setDeletingPlayer(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.championshipRoster(championshipId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.players() }),
      ]);
      notify.success('Jogador removido.');
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível remover o jogador.');
    },
  });

  if (championshipQuery.isLoading) {
    return <p className="text-sm text-subtle">Carregando campeonato…</p>;
  }

  if (championshipQuery.isError || !championshipQuery.data) {
    return <Alert variant="danger">Campeonato não encontrado.</Alert>;
  }

  const championship = championshipQuery.data;
  const roster = rosterQuery.data ?? [];

  const handleStartEdit = (player: { playerId: string; playerName: string }) => {
    setEditingPlayerId(player.playerId);
    setEditingName(player.playerName);
    setEditingError(null);
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setEditingName('');
    setEditingError(null);
  };

  const handleConfirmEdit = (playerId: string) => {
    const validation = validatePlayerName(editingName);
    if (!validation.ok) {
      setEditingError(validation.error);
      return;
    }

    const otherNames = roster
      .filter((entry) => entry.playerId !== playerId)
      .map((entry) => entry.playerName);

    if (findDuplicateNormalizedPlayerName(validation.name, otherNames)) {
      setEditingError(PLAYER_NAME_DUPLICATE_MESSAGE);
      return;
    }

    updateMutation.mutate({ playerId, name: validation.name });
  };

  const handleDelete = (playerId: string) => {
    deleteMutation.mutate(playerId);
  };

  return (
    <section className="space-y-6">
      <div>
        <Link
          className="text-sm text-subtle underline"
          to={`/organizador/campeonato/${championshipId}`}
        >
          ← Voltar ao campeonato
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-foreground">Gerenciar jogadores</h2>
        <p className="mt-2 text-sm text-muted">
          {championship.name} — edite nomes ou remova jogadores ainda sem pontuação ou partidas.
        </p>
      </div>

      {rosterQuery.isLoading ? (
        <p className="text-sm text-subtle">Carregando jogadores…</p>
      ) : roster.length === 0 ? (
        <Alert variant="info">
          Nenhum jogador associado a este campeonato ainda. Crie uma edição e faça o check-in dos
          participantes, ou importe pontuações via CSV.
        </Alert>
      ) : (
        <div className="rounded-2xl border border-line bg-card p-6">
          <ul className="space-y-3">
            {roster.map((entry) => {
              const isEditing = editingPlayerId === entry.playerId;
              return (
                <li
                  key={entry.playerId}
                  className="flex flex-col gap-3 rounded-lg border border-line bg-card-muted p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {isEditing ? (
                    <div className="flex flex-1 flex-col gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(event) => {
                          setEditingName(event.target.value);
                          if (editingError) setEditingError(null);
                        }}
                        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-foreground"
                        disabled={updateMutation.isPending}
                      />
                      {editingError ? <Alert variant="danger">{editingError}</Alert> : null}
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{entry.playerName}</p>
                      <p className="text-sm text-subtle">{entry.accumulatedPoints} pts</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={updateMutation.isPending}
                          onClick={() => handleConfirmEdit(entry.playerId)}
                          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50"
                        >
                          {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
                        </button>
                        <button
                          type="button"
                          disabled={updateMutation.isPending}
                          onClick={handleCancelEdit}
                          className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-card-muted disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(entry)}
                          className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-card-muted"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeletingPlayer({
                              playerId: entry.playerId,
                              playerName: entry.playerName,
                            })
                          }
                          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
                        >
                          Remover
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        isOpen={deletingPlayer !== null}
        title="Remover jogador"
        description={
          deletingPlayer ? (
            <>
              Tem certeza que deseja remover <strong>{deletingPlayer.playerName}</strong>? Esta ação
              não pode ser desfeita. O jogador só será removido se não tiver pontuação, partidas ou
              participação em edições já sorteadas.
            </>
          ) : null
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingPlayer) {
            handleDelete(deletingPlayer.playerId);
          }
        }}
        onCancel={() => setDeletingPlayer(null)}
      />
    </section>
  );
}
