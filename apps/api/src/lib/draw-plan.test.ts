import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { executeExplicitDraw } from '@clandestino/tournament-engine';
import { describe, expect, it } from 'vitest';
import {
  deriveRulesFromDrawPlan,
  mergeDrawPlan,
  validateDrawPlanAgainstRegistrations,
} from './draw-plan.js';

describe('draw-plan', () => {
  it('merges partial draw plan patches', () => {
    expect(
      mergeDrawPlan({ groupCount: 2, groupSizes: [3, 3] }, { seedPlayerIds: ['a', 'b'] }),
    ).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'b'],
    });
  });

  it('derives rules from group count', () => {
    expect(
      deriveRulesFromDrawPlan(DEFAULT_EDITION_RULES, {
        groupCount: 2,
        groupSizes: [3, 3],
      }),
    ).toMatchObject({
      minimumGroupSize: 3,
      protectedSeedCount: 2,
    });
  });

  it('invalidates an approved preview when draw inputs are patched without a replacement', () => {
    expect(
      mergeDrawPlan(
        {
          groupCount: 2,
          groupSizes: [3, 3],
          seedPlayerIds: ['a', 'b'],
          randomSeed: 'old-seed',
          approvedGroups: [{ playerIds: ['a', 'c', 'e'] }, { playerIds: ['b', 'd', 'f'] }],
        },
        { seedPlayerIds: ['a', 'c'] },
      ),
    ).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'c'],
    });
  });

  it('validates seed count against group count', () => {
    const error = validateDrawPlanAgainstRegistrations(
      {
        groupCount: 2,
        groupSizes: [3, 3],
        seedPlayerIds: ['a'],
      },
      6,
      new Set(['a', 'b', 'c', 'd', 'e', 'f']),
    );

    expect(error).toContain('seeds');
  });

  it('accepts only approved groups reproduced by the same draw inputs', () => {
    const playerIds = ['a', 'b', 'c', 'd', 'e', 'f'];
    const input = {
      playerIds,
      seedPlayerIds: ['a', 'b'],
      groupSizes: [3, 3],
      randomSeed: 'approved-plan-seed',
    };
    const draw = executeExplicitDraw(input);
    const approvedGroups = draw.groups.map((group) => ({
      playerIds: group.players.map((player) => player.playerId),
    }));

    expect(
      validateDrawPlanAgainstRegistrations(
        { ...input, groupCount: 2, approvedGroups },
        playerIds.length,
        new Set(playerIds),
      ),
    ).toBeNull();

    const shiftedGroups = approvedGroups.map((group) => ({ playerIds: [...group.playerIds] }));
    const movedPlayer = shiftedGroups[0]!.playerIds[1]!;
    shiftedGroups[0]!.playerIds[1] = shiftedGroups[1]!.playerIds[1]!;
    shiftedGroups[1]!.playerIds[1] = movedPlayer;

    expect(
      validateDrawPlanAgainstRegistrations(
        { ...input, groupCount: 2, approvedGroups: shiftedGroups },
        playerIds.length,
        new Set(playerIds),
      ),
    ).toContain('não correspondem');
  });
});
