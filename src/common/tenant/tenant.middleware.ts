import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: any, res: any, next: () => void) {
    const slug = req.headers['x-tenant-slug'];

    /**
     * Fontos:
     * - Nálad a req.path néha csak "/"-t ad vissza,
     *   ezért a tényleges útvonalhoz a req.originalUrl-t használjuk.
     */
    const url: string = req.originalUrl || req.url || req.path || '';

    /**
     * Nyitott (tenant header nélküli) útvonalak:
     * - tenant létrehozás
     * - globális login
     *
     * (Ha később bevezetsz /api prefixet, akkor a startsWith így is működni fog,
     * mert egyszerűen felveszed a /api/... variánsokat is.)
     */
    const openPathPrefixes = ['/tenants', '/auth/login-global'];

    const isOpen = openPathPrefixes.some((p) => url.startsWith(p));

    // Ha nincs slug és nem nyitott útvonal, akkor hibát dobunk
    if (!slug && !isOpen) {
      throw new BadRequestException('Missing x-tenant-slug header');
    }

    // Ha van slug, beazonosítjuk a tenantot és rátesszük a requestre
    if (slug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: String(slug) },
      });

      if (!tenant) {
        throw new BadRequestException('Invalid tenant slug');
      }

      req.tenant = tenant;
    }

    next();
  }
}
