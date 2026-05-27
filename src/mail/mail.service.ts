import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

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
  private readonly resendEndpoint = 'https://api.resend.com/emails';
  private transporter?: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(private readonly config: ConfigService) {}

  async sendMail(input: SendMailInput) {
    const fromEmail = this.getRequiredConfig('SMTP_FROM_EMAIL');
    const fromName =
      this.config.get<string>('SMTP_FROM_NAME') ?? 'Fempy csapata';
    const defaultReplyTo = this.config.get<string>('SMTP_REPLY_TO');
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');

    try {
      if (resendApiKey) {
        return await this.sendWithResend(input, {
          apiKey: resendApiKey,
          fromEmail,
          fromName,
          replyTo: input.replyTo ?? defaultReplyTo,
        });
      }

      const transporter = this.getTransporter();

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

  private async sendWithResend(
    input: SendMailInput,
    config: {
      apiKey: string;
      fromEmail: string;
      fromName: string;
      replyTo?: string;
    },
  ) {
    this.logger.log(
      `Resend HTTP email init: from=${config.fromEmail}, to=${this.formatRecipientForLog(input.to)}`,
    );

    const payload = {
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [this.formatRecipientForResend(input.to)],
      reply_to: config.replyTo ? [config.replyTo] : undefined,
      subject: input.subject,
      html: input.html,
      text:
        input.text ??
        'Az uzenet megtekintesehez hasznaljon HTML-kompatibilis e-mail megjelenitot!',
      attachments: input.attachments?.length
        ? await this.formatAttachmentsForResend(input.attachments)
        : undefined,
    };

    const response = await fetch(this.resendEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const responseBody = responseText ? this.tryParseJson(responseText) : null;

    if (!response.ok) {
      throw new Error(
        `Resend API error ${response.status}: ${JSON.stringify(responseBody ?? responseText)}`,
      );
    }

    return responseBody;
  }

  private getTransporter() {
    if (!this.transporter) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      const secure = this.config.get<string>('SMTP_SECURE') === 'true';
      const host = this.getRequiredConfig('SMTP_HOST');

      this.logger.log(
        `SMTP transporter init: host=${host}, port=${port}, secure=${secure}, user=${this.getRequiredConfig('SMTP_USER')}`,
      );

      this.transporter = nodemailer.createTransport({
        host,
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

  private formatRecipientForResend(recipient: MailRecipient) {
    if (typeof recipient === 'string') {
      return recipient;
    }

    return recipient.name
      ? `${recipient.name} <${recipient.email}>`
      : recipient.email;
  }

  private formatRecipientForLog(recipient: MailRecipient) {
    return typeof recipient === 'string' ? recipient : recipient.email;
  }

  private async formatAttachmentsForResend(attachments: Mail.Attachment[]) {
    return Promise.all(
      attachments.map(async (attachment) => {
        const path =
          typeof attachment.path === 'string' ? attachment.path : undefined;
        const filename =
          attachment.filename?.toString() ||
          (path ? basename(path) : 'attachment');

        if (path?.startsWith('http://') || path?.startsWith('https://')) {
          return {
            path,
            filename,
            content_id: attachment.cid,
          };
        }

        const content = attachment.content
          ? Buffer.isBuffer(attachment.content)
            ? attachment.content
            : Buffer.from(String(attachment.content))
          : path
            ? await readFile(path)
            : undefined;

        if (!content) {
          throw new Error(`Email attachment content missing: ${filename}`);
        }

        return {
          filename,
          content: content.toString('base64'),
          content_id: attachment.cid,
          content_type: attachment.contentType,
        };
      }),
    );
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
