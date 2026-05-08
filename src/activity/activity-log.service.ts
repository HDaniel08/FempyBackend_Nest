import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ActivityActor = {
  type: 'USER' | 'PLATFORM_ADMIN' | 'SYSTEM';
  id?: string | null;
};

export type ActivityRequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
  supportSessionId?: string | null;
  impersonation?: Record<string, any> | null;
};

export type ActivityLogInput = {
  tenantId: string;
  userId?: string | null;
  actor?: ActivityActor;
  event: string;
  category?: 'AUDIT' | 'APP' | 'SYSTEM';
  source?: string;
  entityType?: string | null;
  entityId?: string | null;
  supportSessionId?: string | null;
  metadata?: Record<string, any> | null;
  request?: ActivityRequestMeta | null;
};

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: ActivityLogInput) {
    const category = input.category ?? this.inferCategory(input.event);
    const supportSessionId = input.supportSessionId ?? null;

    try {
      return await this.prisma.activityEvent.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          event: input.event,
          category,
          source: input.source ?? 'api',
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          supportSessionId,
          metadata: this.sanitizeMetadata({
            ...(input.metadata ?? {}),
            actor: input.actor ?? { type: input.userId ? 'USER' : 'SYSTEM' },
            impersonation: input.request?.impersonation ?? null,
          }),
          ipAddress: input.request?.ipAddress ?? null,
          userAgent: input.request?.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Activity log failed for ${input.event}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  requestMeta(req: any): ActivityRequestMeta {
    return {
      ipAddress:
        req?.ip ??
        req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ??
        req?.socket?.remoteAddress ??
        null,
      userAgent: req?.headers?.['user-agent'] ?? null,
      supportSessionId: req?.headers?.['x-support-session-id'] ?? null,
      impersonation: req?.user?.impersonated
        ? {
            active: true,
            platformAdminId: req.user.impersonatedByPlatformAdminId ?? null,
            reason: req.user.impersonationReason ?? null,
          }
        : null,
    };
  }

  private inferCategory(event: string): 'AUDIT' | 'APP' | 'SYSTEM' {
    if (event.startsWith('SUPER_ADMIN_') || event.startsWith('ADMIN_')) {
      return 'AUDIT';
    }
    if (event.startsWith('SYSTEM_')) return 'SYSTEM';
    return 'APP';
  }

  private sanitizeMetadata(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeMetadata(item));
    if (!value || typeof value !== 'object') return value;

    const blocked = new Set([
      'password',
      'passwordHash',
      'temporaryPassword',
      'adminPassword',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'authorization',
      'comment',
      'body',
      'description',
    ]);

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        blocked.has(key) ? '[redacted]' : this.sanitizeMetadata(item),
      ]),
    );
  }
}
