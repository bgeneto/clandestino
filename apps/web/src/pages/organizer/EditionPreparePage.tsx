import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executeExplicitDraw } from '@clandestino/tournament-engine';
import { useChampionshipRoster, useEditionRegistrations } from '../../hooks/use-organizer-data.js';
import { useEdition } from '../../hooks/use-edition.js';
import { createEditionWizardDraft } from '../../offline/edition-wizard-draft.js';
import { useOnlineStatus } from '../../hooks/use-online-status.js';
import type { EditionWizardDraft, WizardDraftPlayer } from '../../db/clandestino-db.js';
import {
  deleteEditionWizardDraft,
  getEditionWizardDraft,
  getEditionWizardDraftByEditionId,
  removeCheckedInPlayer,
  saveEditionWizardDraft,
  upsertCheckedInPlayer,
} from '../../offline/edition-wizard-draft.js';
import { canPublishDraft, syncEditionWizardDraft } from '../../offline/sync-edition-wizard.js';
import {
  draftMissingServerRegistrations,
  mergeDraftWithServerRegistrations,
  syncWizardAddNewPlayer,
  syncWizardCheckInToggle,
} from '../../offline/sync-wizard-check-in.js';
import { CheckInStep } from '../../components/organizer/edition-wizard/CheckInStep.js';
import { DrawPreviewStep } from '../../components/organizer/edition-wizard/DrawPreviewStep.js';
import { GroupsFormatStep } from '../../components/organizer/edition-wizard/GroupsFormatStep.js';
import { ReviewStep } from '../../components/organizer/edition-wizard/ReviewStep.js';
import { SeedsStep } from '../../components/organizer/edition-wizard/SeedsStep.js';
import { WizardStepNav } from '../../components/organizer/edition-wizard/WizardStepNav.js';
import { EditionAccessSection } from '../../components/organizer/EditionAccessSection.js';
import { formatEditionDate } from '../../lib/format.js';
import { Alert } from '../../components/ui/Alert.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { deleteEdition } from '../../lib/organizer-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { invalidateEditionAfterPublish } from '../../lib/invalidate-edition-queries.js';
import { purgeEditionLocalState } from '../../lib/purge-edition-state.js';
import { createClientId } from '../../lib/create-client-id.js';
import { notifyApiError } from '../../notifications/notify-api-error.js';
import { useNotification } from '../../notifications/notification-context.js';

function createLocalPlayerId(name: string): string {
  return `local-${name.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
}

function createRandomSeed(): string {
  return createClientId('seed');
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameNumberArray(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function shouldRunDrawPreview(draft: EditionWizardDraft, seedPlayerIds: string[]): boolean {
  if (!draft.drawPreview?.length || !draft.drawRandomSeed) {
    return true;
  }

  const checkedInPlayerIds = new Set(draft.checkedInPlayers.map((player) => player.playerId));
  const previewPlayerIds = new Set(
    draft.drawPreview.flatMap((group) => group.players.map((player) => player.playerId)),
  );

  if (checkedInPlayerIds.size !== previewPlayerIds.size) {
    return true;
  }

  for (const playerId of checkedInPlayerIds) {
    if (!previewPlayerIds.has(playerId)) {
      return true;
    }
  }

  if (!draft.seedPlayerIds || !sameStringArray(draft.seedPlayerIds, seedPlayerIds)) {
    return true;
  }

  if (!draft.groupSizes) {
    return true;
  }

  const previewGroupSizes = draft.drawPreview.map((group) => group.players.length);
  if (!sameNumberArray(draft.groupSizes, previewGroupSizes)) {
    return true;
  }

  return false;
}

function buildDrawPreview(
  draft: EditionWizardDraft,
  randomSeed: string,
): EditionWizardDraft['drawPreview'] {
  if (!draft.groupSizes || !draft.seedPlayerIds) {
    return [];
  }

  const playerNameById = new Map(
    draft.checkedInPlayers.map((player) => [player.playerId, player.playerName]),
  );
  const draw = executeExplicitDraw({
    playerIds: draft.checkedInPlayers.map((player) => player.playerId),
    seedPlayerIds: draft.seedPlayerIds,
    groupSizes: draft.groupSizes,
    randomSeed,
  });

  return draw.groups.map((group) => ({
    name: group.name,
    players: group.players.map((player) => ({
      playerId: player.playerId,
      playerName: playerNameById.get(player.playerId) ?? 'Jogador',
      isSeed: player.isSeed,
    })),
  }));
}

export function EditionPreparePage() {
  const navigate = useNavigate();
  const { editionId, championshipId, draftId } = useParams<{
    editionId?: string;
    championshipId?: string;
    draftId?: string;
  }>();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const notify = useNotification();
  const editionQuery = useEdition(editionId);
  const registrationsQuery = useEditionRegistrations(editionId);
  const [draft, setDraft] = useState<EditionWizardDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const rosterChampionshipId =
    draft?.championshipId ?? championshipId ?? editionQuery.data?.championshipId;
  const rosterQuery = useChampionshipRoster(rosterChampionshipId);

  const deleteMutation = useMutation({
    mutationFn: () => deleteEdition(draft!.editionId!),
    onSuccess: async (result) => {
      setIsDeleteDialogOpen(false);
      if (draft?.id) {
        await deleteEditionWizardDraft(draft.id);
      }
      await purgeEditionLocalState(result.id);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.championshipEditions(result.championshipId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizerActiveEditions() }),
      ]);
      void navigate(`/organizador/campeonato/${result.championshipId}`);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível excluir a edição.');
      setIsDeleteDialogOpen(false);
    },
  });

  const loadDraft = useCallback(async () => {
    if (draftId) {
      setLoading(true);
      const loaded = await getEditionWizardDraft(draftId);
      setDraft(loaded ?? null);
      setLoading(false);
      return;
    }

    if (!editionId) {
      setDraft(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const loaded = await getEditionWizardDraftByEditionId(editionId);
    if (loaded) {
      setDraft(loaded);
      setLoading(false);
      return;
    }

    if (!editionQuery.data) {
      return;
    }

    const created = await createEditionWizardDraft({
      championshipId: editionQuery.data.championshipId,
      editionId: editionQuery.data.id,
      predictedEditionName: editionQuery.data.name,
      date: editionQuery.data.date,
      autoConfirmMinutes: editionQuery.data.autoConfirmMinutes,
    });
    setDraft(created);
    setLoading(false);
  }, [draftId, editionId, editionQuery.data]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const availablePlayers = useMemo<WizardDraftPlayer[]>(() => {
    return (rosterQuery.data ?? []).map((entry) => ({
      playerId: entry.playerId,
      playerName: entry.playerName,
      accumulatedPoints: entry.accumulatedPoints,
    }));
  }, [rosterQuery.data]);

  const persistDraft = useCallback(async (nextDraft: EditionWizardDraft) => {
    const saved = await saveEditionWizardDraft(nextDraft);
    setDraft(saved);
    return saved;
  }, []);

  useEffect(() => {
    if (!draft?.editionId || !registrationsQuery.data || !rosterQuery.data) {
      return;
    }

    if (!draftMissingServerRegistrations(draft, registrationsQuery.data)) {
      return;
    }

    const rosterByPlayerId = new Map(
      rosterQuery.data.map((entry) => [
        entry.playerId,
        { playerName: entry.playerName, accumulatedPoints: entry.accumulatedPoints },
      ]),
    );
    const merged = mergeDraftWithServerRegistrations(
      draft,
      registrationsQuery.data,
      rosterByPlayerId,
    );

    void persistDraft(merged);
  }, [draft, registrationsQuery.data, rosterQuery.data, persistDraft]);

  const goToStep = useCallback(
    async (step: number) => {
      if (!draft) {
        return;
      }

      let latestDraft = draft;
      if (draft.id) {
        const stored = await getEditionWizardDraft(draft.id);
        if (stored) {
          latestDraft = stored;
        }
      }

      await persistDraft({ ...latestDraft, currentStep: step });
    },
    [draft, persistDraft],
  );

  const runDrawPreview = useCallback(
    async (sourceDraft: EditionWizardDraft, randomSeed = createRandomSeed()) => {
      const preview = buildDrawPreview(sourceDraft, randomSeed);
      return persistDraft({
        ...sourceDraft,
        drawRandomSeed: randomSeed,
        drawPreview: preview,
        syncStatus:
          sourceDraft.syncStatus === 'SINCRONIZADO' ? 'SINCRONIZADO' : 'PRONTO_PARA_SINCRONIZAR',
      });
    },
    [persistDraft],
  );

  if (loading) {
    return <p className="text-sm text-subtle">Carregando preparação da edição…</p>;
  }

  if (!draft) {
    return <Alert variant="danger">Rascunho da edição não encontrado.</Alert>;
  }

  const backLink = draft.editionId
    ? `/organizador/edicao/${draft.editionId}`
    : `/organizador/campeonato/${draft.championshipId}`;

  const canDelete =
    Boolean(draft.editionId) &&
    (editionQuery.data?.status === 'RASCUNHO' ||
      editionQuery.data?.status === 'INSCRICOES_ABERTAS') &&
    draft.checkedInPlayers.length === 0 &&
    (registrationsQuery.data?.length ?? 0) === 0;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6">
        <Link className="text-sm text-subtle underline" to={backLink}>
          ← Voltar
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          <b>Configurar</b> {draft.predictedEditionName}
        </h2>
        <p className="mt-2 text-sm text-muted">
          Dia {formatEditionDate(draft.date)} · auto-confirmação em {draft.autoConfirmMinutes} min
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <WizardStepNav currentStep={draft.currentStep} />
          {canDelete ? (
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="inline-flex rounded-lg border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
            >
              🗑️ Excluir edição
            </button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Excluir edição"
        description={
          <>
            Tem certeza que deseja excluir <strong>{draft.predictedEditionName}</strong>? A data e o
            tempo de auto-confirmação serão perdidos. Esta ação não pode ser desfeita — você poderá
            criar uma nova edição em seguida.
          </>
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => void deleteMutation.mutateAsync()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />

      <EditionAccessSection
        editionId={draft.editionId}
        editionName={draft.predictedEditionName}
        editionStatus={editionQuery.data?.status}
        offlinePending={!isOnline && !draft.editionId}
      />

      {draft.currentStep === 2 ? (
        <CheckInStep
          draft={draft}
          availablePlayers={availablePlayers}
          onTogglePlayer={(player) => {
            void (async () => {
              const wasCheckedIn = draft.checkedInPlayers.some(
                (entry) => entry.playerId === player.playerId,
              );
              const previousDraft = draft;
              const nextDraft = wasCheckedIn
                ? removeCheckedInPlayer(draft, player.playerId)
                : upsertCheckedInPlayer(draft, player);

              try {
                const savedDraft = await persistDraft(nextDraft);
                if (isOnline && draft.editionId) {
                  const syncedDraft = await syncWizardCheckInToggle({
                    draft: savedDraft,
                    player,
                    checkingIn: !wasCheckedIn,
                    queryClient,
                  });
                  await persistDraft(syncedDraft);
                }
              } catch (error) {
                await persistDraft(previousDraft);
                notifyApiError(
                  notify,
                  error,
                  'Não foi possível sincronizar o check-in com o servidor.',
                );
              }
            })();
          }}
          onAddNewPlayer={(name) => {
            void (async () => {
              const player: WizardDraftPlayer = {
                playerId: createLocalPlayerId(name),
                playerName: name,
                accumulatedPoints: 0,
                isNew: true,
              };
              const previousDraft = draft;
              const nextDraft = upsertCheckedInPlayer(draft, player);

              try {
                const savedDraft = await persistDraft(nextDraft);
                if (isOnline && draft.editionId) {
                  const syncedDraft = await syncWizardAddNewPlayer({
                    draft: savedDraft,
                    player,
                    queryClient,
                  });
                  await persistDraft(syncedDraft);
                }
              } catch (error) {
                await persistDraft(previousDraft);
                notifyApiError(notify, error, 'Não foi possível adicionar o jogador no servidor.');
              }
            })();
          }}
          onContinue={() => void goToStep(3)}
        />
      ) : null}

      {draft.currentStep === 3 ? (
        <GroupsFormatStep
          draft={draft}
          onChange={(patch) => {
            void persistDraft({ ...draft, ...patch });
          }}
          onBack={() => void goToStep(2)}
          onContinue={() => void goToStep(4)}
        />
      ) : null}

      {draft.currentStep === 4 ? (
        <SeedsStep
          draft={draft}
          onChange={(seedPlayerIds) => {
            void persistDraft({ ...draft, seedPlayerIds });
          }}
          onBack={() => void goToStep(3)}
          onContinue={async (seedPlayerIds) => {
            const draftWithSeeds = { ...draft, seedPlayerIds };
            if (shouldRunDrawPreview(draft, seedPlayerIds)) {
              await runDrawPreview(draftWithSeeds, createRandomSeed());
            } else {
              await persistDraft(draftWithSeeds);
            }
            await goToStep(5);
          }}
        />
      ) : null}

      {draft.currentStep === 5 ? (
        <DrawPreviewStep
          draft={draft}
          onBack={() => void goToStep(4)}
          onContinue={() => void goToStep(6)}
          onRedraw={() => {
            void runDrawPreview(draft, createRandomSeed());
          }}
        />
      ) : null}

      {draft.currentStep === 6 ? (
        <ReviewStep
          draft={draft}
          isOnline={isOnline}
          isPublishing={isPublishing}
          onBack={() => void goToStep(5)}
          onPublish={async () => {
            if (!canPublishDraft(draft)) {
              notify.warning('Complete todos os passos antes de publicar.');
              return;
            }

            if (!isOnline) {
              await persistDraft({
                ...draft,
                syncStatus: 'PRONTO_PARA_SINCRONIZAR',
              });
              notify.success('Sorteio salvo localmente. Sincronize quando houver conexão.');
              return;
            }

            setIsPublishing(true);
            const result = await syncEditionWizardDraft(draft);
            setIsPublishing(false);

            if (result.status === 'synced') {
              await invalidateEditionAfterPublish(queryClient, result.editionId);
              void navigate(`/organizador/edicao/${result.editionId}`);
              return;
            }

            if (result.status === 'conflict') {
              notify.warning(result.message);
              return;
            }

            notify.danger(result.message);
          }}
        />
      ) : null}
    </section>
  );
}
