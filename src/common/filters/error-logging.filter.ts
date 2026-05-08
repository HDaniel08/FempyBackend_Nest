import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Catch()
export class ErrorLoggingFilter implements ExceptionFilter {
  constructor(private readonly prisma: PrismaService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof Error
        ? exception.message
        : typeof exception === 'string'
          ? exception
          : 'Unhandled error';

    const tenantId = req?.user?.tenantId ?? req?.tenant?.id ?? null;

    if (tenantId && status >= 400) {
      try {
        await this.prisma.activityEvent.create({
          data: {
            tenantId,
            userId: req?.user?.sub ?? null,
            event: 'SYSTEM_REQUEST_FAILED',
            category: 'SYSTEM',
            source: 'api',
            entityType: 'REQUEST',
            entityId: `${req?.method ?? 'UNKNOWN'} ${req?.originalUrl ?? req?.url ?? ''}`,
            metadata: {
              status,
              message,
              method: req?.method ?? null,
              path: req?.originalUrl ?? req?.url ?? null,
            },
            ipAddress:
              req?.ip ??
              req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ??
              req?.socket?.remoteAddress ??
              null,
            userAgent: req?.headers?.['user-agent'] ?? null,
          },
        });
      } catch {
        // Error logging must never hide the original API failure.
      }
    }

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message };

    res.status(status).json(
      typeof responseBody === 'string'
        ? { statusCode: status, message: responseBody }
        : responseBody,
    );
  }
}
