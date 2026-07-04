import { MAX_SETS_SCORE } from '@clandestino/shared-contracts';
import { useMemo, useState } from 'react';
import { ScoreCounter } from './ScoreCounter.js';
import { Alert } from '../ui/Alert.js';
import { validateScoreInput } from '../../lib/match-utils.js';

export type MatchResultMode = 'score' | 'walkover';

export type MatchResultSubmitPayload =
  | {
      outcome: 'PLAYED';
      setsWonByReporter: number;
      setsWonByOpponent: number;
    }
  | {
      outcome: 'WALKOVER';
      absentPlayerId: string;
    };

type MatchResultFormProps = {
  reporterLabel: string;
  opponentLabel: string;
  opponentId: string;
  disabled?: boolean;
  pending?: boolean;
  submitLabel?: string;
  organizerMode?: boolean;
  playerOneId?: string;
  playerTwoId?: string;
  playerOneLabel?: string;
  playerTwoLabel?: string;
  onSubmit: (payload: MatchResultSubmitPayload) => void;
};

export function MatchResultForm({
  reporterLabel,
  opponentLabel,
  opponentId,
  disabled = false,
  pending = false,
  submitLabel = 'Enviar resultado',
  organizerMode = false,
  playerOneId,
  playerTwoId,
  playerOneLabel,
  playerTwoLabel,
  onSubmit,
}: MatchResultFormProps) {
  const [mode, setMode] = useState<MatchResultMode>('score');
  const [reporterSets, setReporterSets] = useState(0);
  const [opponentSets, setOpponentSets] = useState(0);
  const [playerOneSets, setPlayerOneSets] = useState(0);
  const [playerTwoSets, setPlayerTwoSets] = useState(0);
  const [absentPlayerId, setAbsentPlayerId] = useState(playerTwoId ?? opponentId);

  const validation = useMemo(() => {
    if (mode === 'walkover') {
      return { valid: true };
    }

    if (organizerMode) {
      return validateScoreInput(playerOneSets, playerTwoSets);
    }

    return validateScoreInput(reporterSets, opponentSets);
  }, [mode, organizerMode, playerOneSets, playerTwoSets, reporterSets, opponentSets]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-card-muted p-1">
        <button
          type="button"
          onClick={() => setMode('score')}
          className={[
            'rounded-lg px-3 py-2.5 text-sm font-semibold transition',
            mode === 'score'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted hover:text-foreground',
          ].join(' ')}
        >
          Placar
        </button>
        <button
          type="button"
          onClick={() => setMode('walkover')}
          className={[
            'rounded-lg px-3 py-2.5 text-sm font-semibold transition',
            mode === 'walkover'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted hover:text-foreground',
          ].join(' ')}
        >
          WO
        </button>
      </div>

      {mode === 'score' ? (
        <section className="rounded-2xl bg-card p-5 shadow-sm">
          {organizerMode ? (
            <div className="flex min-w-0 items-end justify-between gap-1 sm:justify-around sm:gap-2">
              <ScoreCounter
                label={playerOneLabel ?? 'Jogador 1'}
                value={playerOneSets}
                max={MAX_SETS_SCORE}
                onIncrement={() => setPlayerOneSets((value) => Math.min(MAX_SETS_SCORE, value + 1))}
                onDecrement={() => setPlayerOneSets((value) => Math.max(0, value - 1))}
              />
              <span
                className="mb-1.5 shrink-0 text-3xl font-bold text-muted sm:mb-2 sm:text-4xl"
                aria-hidden
              >
                ×
              </span>
              <ScoreCounter
                label={playerTwoLabel ?? 'Jogador 2'}
                value={playerTwoSets}
                max={MAX_SETS_SCORE}
                onIncrement={() => setPlayerTwoSets((value) => Math.min(MAX_SETS_SCORE, value + 1))}
                onDecrement={() => setPlayerTwoSets((value) => Math.max(0, value - 1))}
              />
            </div>
          ) : (
            <div className="flex min-w-0 items-end justify-between gap-1 sm:justify-around sm:gap-2">
              <ScoreCounter
                label={reporterLabel}
                value={reporterSets}
                max={MAX_SETS_SCORE}
                onIncrement={() => setReporterSets((value) => Math.min(MAX_SETS_SCORE, value + 1))}
                onDecrement={() => setReporterSets((value) => Math.max(0, value - 1))}
              />
              <span
                className="mb-1.5 shrink-0 text-3xl font-bold text-muted sm:mb-2 sm:text-4xl"
                aria-hidden
              >
                ×
              </span>
              <ScoreCounter
                label={opponentLabel}
                value={opponentSets}
                max={MAX_SETS_SCORE}
                onIncrement={() => setOpponentSets((value) => Math.min(MAX_SETS_SCORE, value + 1))}
                onDecrement={() => setOpponentSets((value) => Math.max(0, value - 1))}
              />
            </div>
          )}
        </section>
      ) : organizerMode && playerOneId && playerTwoId ? (
        <section className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
          <p className="text-sm text-muted">Quem não compareceu?</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="absent-player"
              checked={absentPlayerId === playerOneId}
              onChange={() => setAbsentPlayerId(playerOneId)}
            />
            <span>{playerOneLabel ?? 'Jogador 1'}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="absent-player"
              checked={absentPlayerId === playerTwoId}
              onChange={() => setAbsentPlayerId(playerTwoId)}
            />
            <span>{playerTwoLabel ?? 'Jogador 2'}</span>
          </label>
        </section>
      ) : (
        <section className="rounded-2xl bg-card p-5 shadow-sm">
          <p className="text-sm text-muted">
            Declaro que <span className="font-semibold text-foreground">{opponentLabel}</span> não
            compareceu à partida.
          </p>
        </section>
      )}

      {mode === 'score' &&
      !validation.valid &&
      (organizerMode
        ? playerOneSets > 0 || playerTwoSets > 0
        : reporterSets > 0 || opponentSets > 0) ? (
        <Alert variant="danger">{validation.reason}</Alert>
      ) : null}

      <button
        type="button"
        disabled={disabled || pending || !validation.valid}
        onClick={() => {
          if (mode === 'walkover') {
            onSubmit({
              outcome: 'WALKOVER',
              absentPlayerId: organizerMode ? absentPlayerId : opponentId,
            });
            return;
          }

          if (organizerMode) {
            onSubmit({
              outcome: 'PLAYED',
              setsWonByReporter: playerOneSets,
              setsWonByOpponent: playerTwoSets,
            });
            return;
          }

          onSubmit({
            outcome: 'PLAYED',
            setsWonByReporter: reporterSets,
            setsWonByOpponent: opponentSets,
          });
        }}
        className="w-full rounded-xl bg-header px-4 py-3.5 text-base font-bold text-header-foreground disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        {pending ? 'Enviando…' : mode === 'walkover' ? 'Registrar vitória por WO' : submitLabel}
      </button>
    </div>
  );
}
