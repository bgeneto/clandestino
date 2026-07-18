import type {
  CorrectMatchResultBody,
  MatchBestOf,
  MatchOutcome,
  SubmitMatchResultBody,
} from '@clandestino/shared-contracts';
import { validateMatchResult } from '@clandestino/tournament-engine';
import { badRequest, unprocessableEntity } from './errors.js';

export interface ParsedMatchResult {
  outcome: MatchOutcome;
  playerOneSets: number;
  playerTwoSets: number;
  walkoverAbsentPlayerId?: string;
}

export const WALKOVER_WINNER_SETS = 1;
export const WALKOVER_LOSER_SETS = 0;

function opponentId(reporterId: string, playerOneId: string, playerTwoId: string): string | null {
  if (reporterId === playerOneId) {
    return playerTwoId;
  }
  if (reporterId === playerTwoId) {
    return playerOneId;
  }
  return null;
}

export function parsePlayerMatchSubmission(
  body: SubmitMatchResultBody,
  reporterId: string,
  playerOneId: string,
  playerTwoId: string,
  bestOf: MatchBestOf,
): ParsedMatchResult {
  const outcome = body.outcome ?? 'PLAYED';

  if (outcome === 'WALKOVER') {
    if (!body.absentPlayerId) {
      throw unprocessableEntity('Informe o jogador ausente para registrar WO.');
    }

    const expectedAbsent = opponentId(reporterId, playerOneId, playerTwoId);
    if (!expectedAbsent || body.absentPlayerId !== expectedAbsent) {
      throw unprocessableEntity('WO só pode ser registrado contra o adversário da partida.');
    }

    const winnerId = reporterId;
    return {
      outcome,
      playerOneSets: winnerId === playerOneId ? WALKOVER_WINNER_SETS : WALKOVER_LOSER_SETS,
      playerTwoSets: winnerId === playerTwoId ? WALKOVER_WINNER_SETS : WALKOVER_LOSER_SETS,
      walkoverAbsentPlayerId: body.absentPlayerId,
    };
  }

  if (body.setsWonByReporter === undefined || body.setsWonByOpponent === undefined) {
    throw unprocessableEntity('Informe o placar da partida.');
  }

  const validation = validateMatchResult(
    {
      setsWonByReporter: body.setsWonByReporter,
      setsWonByOpponent: body.setsWonByOpponent,
    },
    bestOf,
  );

  if (!validation.valid) {
    throw unprocessableEntity('Placar inválido para o formato da partida.', {
      reason: validation.reason,
    });
  }

  const playerOneSets =
    reporterId === playerOneId ? body.setsWonByReporter : body.setsWonByOpponent;
  const playerTwoSets =
    reporterId === playerTwoId ? body.setsWonByReporter : body.setsWonByOpponent;

  return {
    outcome,
    playerOneSets,
    playerTwoSets,
  };
}

export function parseOrganizerMatchCorrection(
  body: CorrectMatchResultBody,
  playerOneId: string,
  playerTwoId: string,
  bestOf: MatchBestOf,
): ParsedMatchResult {
  const outcome = body.outcome ?? 'PLAYED';

  if (outcome === 'WALKOVER') {
    if (!body.absentPlayerId) {
      throw unprocessableEntity('Informe o jogador ausente para registrar WO.');
    }

    if (body.absentPlayerId !== playerOneId && body.absentPlayerId !== playerTwoId) {
      throw badRequest('O jogador ausente deve participar desta partida.');
    }

    const winnerId = body.absentPlayerId === playerOneId ? playerTwoId : playerOneId;
    return {
      outcome,
      playerOneSets: winnerId === playerOneId ? WALKOVER_WINNER_SETS : WALKOVER_LOSER_SETS,
      playerTwoSets: winnerId === playerTwoId ? WALKOVER_WINNER_SETS : WALKOVER_LOSER_SETS,
      walkoverAbsentPlayerId: body.absentPlayerId,
    };
  }

  if (body.setsWonByPlayerOne === undefined || body.setsWonByPlayerTwo === undefined) {
    throw unprocessableEntity('Informe o placar corrigido.');
  }

  const validation = validateMatchResult(
    {
      setsWonByReporter: body.setsWonByPlayerOne,
      setsWonByOpponent: body.setsWonByPlayerTwo,
    },
    bestOf,
  );

  if (!validation.valid) {
    throw unprocessableEntity('Placar inválido para o formato da partida.', {
      reason: validation.reason,
    });
  }

  return {
    outcome,
    playerOneSets: body.setsWonByPlayerOne,
    playerTwoSets: body.setsWonByPlayerTwo,
  };
}
