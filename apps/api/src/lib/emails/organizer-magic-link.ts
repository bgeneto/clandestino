export type OrganizerMagicLinkEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export type BuildOrganizerMagicLinkEmailParams = {
  verifyUrl: string;
  expiresInMinutes: number;
};

function formatExpiryLabel(expiresInMinutes: number): string {
  if (expiresInMinutes === 1) {
    return '1 minuto';
  }
  return `${expiresInMinutes} minutos`;
}

export function buildOrganizerMagicLinkEmail(
  params: BuildOrganizerMagicLinkEmailParams,
): OrganizerMagicLinkEmailContent {
  const { verifyUrl, expiresInMinutes } = params;
  const expiryLabel = formatExpiryLabel(expiresInMinutes);

  const subject = 'Seu link de acesso ao Clandestino';

  const text = [
    'Olá,',
    '',
    'Você solicitou acesso ao painel do organizador do Clandestino — campeonato de tênis de mesa da FitPong.',
    '',
    'Para entrar, abra o link abaixo no seu navegador:',
    verifyUrl,
    '',
    `Este link é válido por ${expiryLabel} e pode ser usado apenas uma vez.`,
    'Se você não solicitou este acesso, ignore este e-mail.',
    '',
    'Clandestino — Tênis de Mesa',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px 28px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">Clandestino</p>
              <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Campeonato de tênis de mesa — FitPong</p>
              <p style="margin:0 0 16px;font-size:16px;">Olá,</p>
              <p style="margin:0 0 16px;font-size:16px;">Você solicitou acesso ao painel do organizador. Clique no botão abaixo para entrar com segurança:</p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${verifyUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 24px;border-radius:8px;">Acessar o painel</a>
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#52525b;">Ou copie e cole este endereço no navegador:</p>
              <p style="margin:0 0 24px;font-size:14px;word-break:break-all;color:#2563eb;">${verifyUrl}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#52525b;">Este link é válido por <strong>${expiryLabel}</strong> e pode ser usado apenas uma vez.</p>
              <p style="margin:0;font-size:14px;color:#71717a;">Se você não solicitou este acesso, ignore este e-mail.</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">Clandestino — Tênis de Mesa</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
