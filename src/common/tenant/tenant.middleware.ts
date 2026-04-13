import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: any, res: any, next: () => void) {
    const url: string = (req.originalUrl || req.url || req.path || '').split('?')[0];

    // Tenant header nélküli publikus útvonalak
    const openPathPrefixes = [
      '/health',
      '/api/health',
      '/tenants',
      '/api/tenants',
      '/auth/login-global',
      '/api/auth/login-global',
    ];

    const isOpen = openPathPrefixes.some(
      (p) => url === p || url.startsWith(`${p}/`),
    );

    if (isOpen) {
      return next();
    }

    const slug = req.headers['x-tenant-slug'];

    if (!slug) {
      throw new BadRequestException('Missing x-tenant-slug header');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: String(slug) },
    });

    if (!tenant) {
      throw new BadRequestException('Invalid tenant slug');
    }

    req.tenant = tenant;
    next();
  }
}