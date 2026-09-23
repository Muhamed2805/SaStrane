import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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
      html: this.verificationEmailHtml(input.fullName, input.code),
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
      html: this.passwordResetEmailHtml(input.fullName, input.code),
      tag: 'password_reset',
      developmentMessage: `Password reset code for ${input.email}: ${input.code}`,
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
      });
    } catch {
      throw new ServiceUnavailableException(
        'Email trenutno nije moguće poslati. Pokušaj ponovo.',
      );
    }

    if (!response.ok) {
      const responseBody = await response.text();
      this.logger.error(
        `Resend rejected verification email (${response.status}): ${responseBody}`,
      );
      throw new ServiceUnavailableException(
        'Email trenutno nije moguće poslati. Pokušaj ponovo.',
      );
    }
  }

  private verificationEmailHtml(fullName: string, code: string) {
    const safeName = escapeHtml(fullName);

    return `
      <!doctype html>
      <html lang="bs">
        <body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#1c2c33">
          <div style="max-width:560px;margin:0 auto;padding:40px 20px">
            <div style="background:#ffffff;border:1px solid #dfe9e7;border-radius:18px;padding:32px">
              <div style="font-size:20px;font-weight:700;color:#0f9f91">SaStrane</div>
              <h1 style="margin:28px 0 12px;font-size:24px">Potvrdi svoj email</h1>
              <p style="margin:0;color:#687978;line-height:1.6">Zdravo ${safeName}, unesi ovaj kod kako bi aktivirao svoj račun:</p>
              <div style="margin:28px 0;padding:18px;border-radius:12px;background:#eef9f7;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#0b746b">${code}</div>
              <p style="margin:0;color:#687978;font-size:14px;line-height:1.6">Kod vrijedi 10 minuta. Ako nisi kreirao SaStrane račun, možeš zanemariti ovu poruku.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private passwordResetEmailHtml(fullName: string, code: string) {
    const safeName = escapeHtml(fullName);

    return `
      <!doctype html>
      <html lang="bs">
        <body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#1c2c33">
          <div style="max-width:560px;margin:0 auto;padding:40px 20px">
            <div style="background:#ffffff;border:1px solid #dfe9e7;border-radius:18px;padding:32px">
              <div style="font-size:20px;font-weight:700;color:#0f9f91">SaStrane</div>
              <h1 style="margin:28px 0 12px;font-size:24px">Postavi novu lozinku</h1>
              <p style="margin:0;color:#687978;line-height:1.6">Zdravo ${safeName}, unesi ovaj kod kako bi postavio novu lozinku:</p>
              <div style="margin:28px 0;padding:18px;border-radius:12px;background:#eef9f7;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#0b746b">${code}</div>
              <p style="margin:0;color:#687978;font-size:14px;line-height:1.6">Kod vrijedi 10 minuta. Ako nisi zatražio promjenu lozinke, možeš zanemariti ovu poruku.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
