import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applicationDecisionEmailHtml,
  applicationDecisionSubject,
  passwordResetEmailHtml,
  verificationEmailHtml,
  type ApplicationDecisionEmail,
} from './email-templates.js';

// Without a deadline a slow email provider would keep the sign-up request
// (and its database row) waiting until the client gives up.
const EMAIL_REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(input: {
    email: string;
    fullName: string;
    code: string;
  }) {
    await this.sendTransactionalEmail({
      to: input.email,
      subject: 'Potvrdi svoj SaStrane račun',
      html: verificationEmailHtml(input.fullName, input.code),
      tag: 'email_verification',
      developmentMessage: `Verification code for ${input.email}: ${input.code}`,
    });
  }

  async sendPasswordResetCode(input: {
    email: string;
    fullName: string;
    code: string;
  }) {
    await this.sendTransactionalEmail({
      to: input.email,
      subject: 'Promijeni svoju SaStrane lozinku',
      html: passwordResetEmailHtml(input.fullName, input.code),
      tag: 'password_reset',
      developmentMessage: `Password reset code for ${input.email}: ${input.code}`,
    });
  }

  // Tells an executor that the client accepted or rejected their
  // application.
  async sendApplicationDecision(input: {
    email: string;
    fullName: string;
    listingId: string;
    listingTitle: string;
    clientName: string;
    accepted: boolean;
  }) {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const email: ApplicationDecisionEmail = {
      ...input,
      listingUrl: `${appUrl}/listings/${encodeURIComponent(input.listingId)}`,
      listingsUrl: `${appUrl}/listings`,
    };

    await this.sendTransactionalEmail({
      to: input.email,
      subject: applicationDecisionSubject(email),
      html: applicationDecisionEmailHtml(email),
      tag: 'application_decision',
      developmentMessage: `Application ${input.accepted ? 'accepted' : 'rejected'} email for ${input.email}: "${input.listingTitle}"`,
    });
  }

  private async sendTransactionalEmail(input: {
    to: string;
    subject: string;
    html: string;
    tag: string;
    developmentMessage: string;
  }) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from =
      this.config.get<string>('EMAIL_FROM') ??
      'SaStrane <onboarding@resend.dev>';

    if (!apiKey) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          'Email delivery is not configured',
        );
      }

      this.logger.warn(`[DEV ONLY] ${input.developmentMessage}`);
      return;
    }

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          tags: [{ name: 'category', value: input.tag }],
        }),
        signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        `Email request (${input.tag}) failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Email trenutno nije moguće poslati. Pokušaj ponovo.',
      );
    }

    if (!response.ok) {
      const responseBody = await response.text();
      this.logger.error(
        `Resend rejected ${input.tag} email (${response.status}): ${responseBody}`,
      );
      throw new ServiceUnavailableException(
        'Email trenutno nije moguće poslati. Pokušaj ponovo.',
      );
    }
  }
}
