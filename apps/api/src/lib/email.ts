import { Resend } from 'resend';
import type { ApiConfig, EmailConfig } from '../config.js';
import { buildOrganizerMagicLinkEmail } from './emails/organizer-magic-link.js';

export type OrganizerMagicLinkEmailParams = {
  to: string;
  verifyUrl: string;
  expiresInMinutes: number;
};

export type EmailSender = {
  sendOrganizerMagicLink(params: OrganizerMagicLinkEmailParams): Promise<void>;
};

export function createNoopEmailSender(): EmailSender {
  return {
    async sendOrganizerMagicLink() {
      // Intencionalmente vazio — usado em dev/teste sem Resend configurado.
    },
  };
}

export function createResendEmailSender(emailConfig: EmailConfig): EmailSender {
  const resend = new Resend(emailConfig.apiKey);
  const from = `${emailConfig.fromName} <${emailConfig.fromEmail}>`;

  return {
    async sendOrganizerMagicLink(params: OrganizerMagicLinkEmailParams) {
      const content = buildOrganizerMagicLinkEmail({
        verifyUrl: params.verifyUrl,
        expiresInMinutes: params.expiresInMinutes,
      });

      const { error } = await resend.emails.send({
        from,
        to: [params.to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}

export function createEmailSender(config: ApiConfig): EmailSender {
  if (!config.sendOrganizerMagicLinkEmail || !config.email) {
    return createNoopEmailSender();
  }

  return createResendEmailSender(config.email);
}
