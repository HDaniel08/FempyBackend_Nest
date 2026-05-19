import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type MailRecipient = string | { email: string; name?: string };

export interface SendMailInput {
  to: MailRecipient;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Mail.Attachment[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(private readonly config: ConfigService) {}

  async sendMail(input: SendMailInput) {
    const transporter = this.getTransporter();
    const fromEmail = this.getRequiredConfig('SMTP_FROM_EMAIL');
    const fromName =
      this.config.get<string>('SMTP_FROM_NAME') ?? 'Fempy csapata';
    const defaultReplyTo = this.config.get<string>('SMTP_REPLY_TO');

    try {
      return await transporter.sendMail({
        from: { address: fromEmail, name: fromName },
        to: this.formatRecipient(input.to),
        replyTo: input.replyTo ?? defaultReplyTo,
        subject: input.subject,
        html: input.html,
        text:
          input.text ??
          'Az uzenet megtekintesehez hasznaljon HTML-kompatibilis e-mail megjelenitot!',
        attachments: input.attachments,
      });
    } catch (error) {
      this.logger.error(
        'Email sending failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Email kuldese sikertelen');
    }
  }

  private getTransporter() {
    if (!this.transporter) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      const secure = this.config.get<string>('SMTP_SECURE') === 'true';

      this.transporter = nodemailer.createTransport({
        host: this.getRequiredConfig('SMTP_HOST'),
        port,
        secure,
        requireTLS: !secure && port === 587,
        connectionTimeout: Number(
          this.config.get<string>('SMTP_CONNECTION_TIMEOUT_MS') ?? 10000,
        ),
        greetingTimeout: Number(
          this.config.get<string>('SMTP_GREETING_TIMEOUT_MS') ?? 10000,
        ),
        socketTimeout: Number(
          this.config.get<string>('SMTP_SOCKET_TIMEOUT_MS') ?? 20000,
        ),
        auth: {
          user: this.getRequiredConfig('SMTP_USER'),
          pass: this.getRequiredConfig('SMTP_PASSWORD'),
        },
      });
    }

    return this.transporter;
  }

  private getRequiredConfig(key: string) {
    const value = this.config.get<string>(key);

    if (!value) {
      throw new Error(`${key} nincs beallitva a .env-ben`);
    }

    return value;
  }

  private formatRecipient(recipient: MailRecipient) {
    if (typeof recipient === 'string') {
      return recipient;
    }

    if (!recipient.name) {
      return recipient.email;
    }

    return {
      address: recipient.email,
      name: recipient.name,
    };
  }
}
