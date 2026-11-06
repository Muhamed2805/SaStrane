import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applicationDecisionEmailHtml,
  applicationDecisionSubject,
  invitationEmailHtml,
  invitationSubject,
  newApplicationEmailHtml,
  newApplicationSubject,
  passwordChangedEmailHtml,
  passwordResetEmailHtml,
  unreadMessagesEmailHtml,
  unreadMessagesSubject,
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

  // Tells the user that their password was changed while signed in, in
  // case someone else did it.
  async sendPasswordChanged(input: { email: string; fullName: string }) {
    await this.sendTransactionalEmail({
      to: input.email,
      subject: 'Lozinka je promijenjena',
      html: passwordChangedEmailHtml(input.fullName),
      tag: 'password_changed',
      developmentMessage: `Password changed email for ${input.email}`,
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

  // Tells a client that someone applied to their job.
  async sendNewApplication(input: {
    email: string;
    fullName: string;
    listingTitle: string;
    executorName: string;
    proposedPrice: number | null;
    message: string;
  }) {
    await this.sendTransactionalEmail({
      to: input.email,
      subject: newApplicationSubject(input),
      html: newApplicationEmailHtml({
        ...input,
        applicationsUrl: this.appUrl('/inbox?tab=received'),
        settingsUrl: this.appUrl('/settings'),
      }),
      tag: 'new_application',
      developmentMessage: `New application email for ${input.email}: "${input.listingTitle}"`,
    });
  }

  // Tells a user that a client invites them to apply to a job.
  async sendInvitation(input: {
    email: string;
    fullName: string;
    listingId: string;
    listingTitle: string;
    clientName: string;
    budget: number | null;
  }) {
    await this.sendTransactionalEmail({
      to: input.email,
      subject: invitationSubject(input),
      html: invitationEmailHtml({
        ...input,
        listingUrl: this.appUrl(
          `/listings/${encodeURIComponent(input.listingId)}`,
        ),
        settingsUrl: this.appUrl('/settings'),
      }),
      tag: 'invitation',
      developmentMessage: `Invitation email for ${input.email}: "${input.listingTitle}"`,
    });
  }

  // Tells a user about messages they have not read for a while.
  async sendUnreadMessages(input: {
    email: string;
    fullName: string;
    conversationId: string;
    listingTitle: string;
    senderName: string;
    unreadCount: number;
    lastMessage: string;
  }) {
    await this.sendTransactionalEmail({
      to: input.email,
      subject: unreadMessagesSubject(input),
      html: unreadMessagesEmailHtml({
        ...input,
        conversationUrl: this.appUrl(
          `/messages/${encodeURIComponent(input.conversationId)}`,
        ),
        settingsUrl: this.appUrl('/settings'),
      }),
      tag: 'unread_messages',
      developmentMessage: `Unread messages email for ${input.email}: ${input.unreadCount} in "${input.listingTitle}"`,
    });
  }

  private appUrl(path: string) {
    return `${this.config.getOrThrow<string>('APP_URL')}${path}`;
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
