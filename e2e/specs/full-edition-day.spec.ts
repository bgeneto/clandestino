import { expect, test } from '@playwright/test';
import {
  confirmMatchResult,
  createEditionWithScheduledGroupMatch,
  loginOrganizer,
  matchParticipantIds,
  requestOrganizerVerifyPath,
  submitPlayedResult,
} from '../helpers/api.js';

const apiBaseUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:5173/api';

test.describe('dia completo da edição (E2E)', () => {
  test.setTimeout(60_000);

  test('libera QR e WhatsApp somente depois de publicar grupos e partidas', async ({ page }) => {
    const organizer = await loginOrganizer(apiBaseUrl);
    const auth = {
      authorization: `Bearer ${organizer.sessionToken}`,
      'content-type': 'application/json',
    };
    const championshipResponse = await fetch(`${apiBaseUrl}/championships`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: `E2E QR Gate ${Date.now()}` }),
    });
    expect(championshipResponse.status).toBe(201);
    const championship = (await championshipResponse.json()) as { id: string };

    const draftResponse = await fetch(`${apiBaseUrl}/editions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        championshipId: championship.id,
        date: '2026-07-10',
      }),
    });
    expect(draftResponse.status).toBe(201);
    const draftEdition = (await draftResponse.json()) as { editions: Array<{ id: string }> };
    const draftEditionId = draftEdition.editions[0]!.id;

    const published = await createEditionWithScheduledGroupMatch(apiBaseUrl);
    const organizerVerifyPath = await requestOrganizerVerifyPath(apiBaseUrl);
    await page.goto(organizerVerifyPath);
    await expect(page).toHaveURL(/\/organizador\/painel/);

    await page.goto(`/organizador/edicao/${draftEditionId}`);
    await expect(page.getByText('Acesso dos jogadores')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Compartilhar link no WhatsApp' })).toHaveCount(0);

    await page.goto(`/organizador/edicao/${published.editionId}?publicado=1`);
    await expect(page.getByText('Publicação concluída.')).toBeVisible();
    await expect(page.getByText('Acesso dos jogadores')).toBeVisible();
    await expect(page.getByAltText('QR code da edição')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compartilhar link no WhatsApp' })).toBeVisible();
  });

  test.fixme('adversário confirma placar na UI após registro via API', async ({
    page,
    browser,
  }) => {
    const setup = await createEditionWithScheduledGroupMatch(apiBaseUrl);
    const organizerVerifyPath = await requestOrganizerVerifyPath(apiBaseUrl);
    const [reporterId, opponentId] = matchParticipantIds(setup.scheduledGroupMatch);
    const reporterName = setup.playerNames[setup.playerIds.indexOf(reporterId)] ?? 'Jogador';
    const opponentName = setup.playerNames[setup.playerIds.indexOf(opponentId)] ?? 'Adversário';

    const submitted = await submitPlayedResult(
      apiBaseUrl,
      setup.editionId,
      setup.scheduledGroupMatch,
      reporterId,
    );
    expect(submitted.status).toBe('AGUARDANDO_CONFIRMACAO');

    const opponentContext = await browser.newContext();
    const opponentPage = await opponentContext.newPage();

    await opponentPage.goto(`/edicao/${setup.editionId}/entrar`);
    await expect(opponentPage.getByRole('button', { name: opponentName })).toBeVisible();
    await opponentPage.getByRole('button', { name: opponentName }).click();
    await opponentPage.getByRole('button', { name: /Confirmar e entrar/ }).click();
    await expect(opponentPage.getByRole('button', { name: 'Confirmar' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await opponentPage.getByRole('button', { name: 'Confirmar' }).first().click();
    await expect(opponentPage.getByText(/Confirmada/).first()).toBeVisible({ timeout: 15_000 });

    await opponentContext.close();

    await page.goto(organizerVerifyPath);
    await expect(page).toHaveURL(/\/organizador\/painel/);
    await page.goto(`/organizador/edicao/${setup.editionId}`);
    await expect(page.getByText(reporterName).first()).toBeVisible();
    await expect(page.getByText(opponentName).first()).toBeVisible();
  });

  test('API conclui fase de grupos e organizador encerra edição pela UI', async ({ page }) => {
    const setup = await createEditionWithScheduledGroupMatch(apiBaseUrl);
    const organizerVerifyPath = await requestOrganizerVerifyPath(apiBaseUrl);

    const groups = await fetch(`${apiBaseUrl}/editions/${setup.editionId}/groups`, {
      headers: { authorization: `Bearer ${setup.organizerSessionToken}` },
    }).then(
      (response) =>
        response.json() as Promise<{ groups: Array<{ group: { id: string; phase: string } }> }>,
    );

    const groupStageIds = groups.groups
      .filter((entry) => entry.group.phase === 'GROUP_STAGE')
      .map((entry) => entry.group.id);

    const matches = await fetch(`${apiBaseUrl}/editions/${setup.editionId}/matches`, {
      headers: { authorization: `Bearer ${setup.organizerSessionToken}` },
    }).then(
      (response) =>
        response.json() as Promise<{
          matches: Array<{
            id: string;
            groupId: string;
            status: string;
            participants: Array<{ playerId: string }>;
          }>;
        }>,
    );

    const groupMatches = matches.matches.filter((match) => groupStageIds.includes(match.groupId));

    for (const match of groupMatches) {
      const [reporterId, opponentId] = matchParticipantIds(match);
      const submitted = await submitPlayedResult(apiBaseUrl, setup.editionId, match, reporterId);
      if (submitted.status === 'AGUARDANDO_CONFIRMACAO') {
        await confirmMatchResult(apiBaseUrl, setup.editionId, match.id, opponentId);
      }
    }

    await page.goto(organizerVerifyPath);
    await expect(page).toHaveURL(/\/organizador\/painel/);

    await page.goto(`/organizador/edicao/${setup.editionId}`);
    await page.getByRole('button', { name: 'Encerrar edição' }).click();
    await expect(page.locator('main').getByText('Encerrada').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
