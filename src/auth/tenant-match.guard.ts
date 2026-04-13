import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * TenantMatchGuard:
 * - Feltételezi, hogy a JwtAuthGuard már lefutott (tehát van req.user).
 * - Ellenőrzi, hogy:
 *    req.user.tenantId (tokenből) === req.tenant.id (headerből + DB-ből)
 */
@Injectable()
export class TenantMatchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const tokenTenantId = req.user?.tenantId;
    const headerTenantId = req.tenant?.id;

    if (!tokenTenantId || !headerTenantId) {
      // Ez normál esetben nem fordulhat elő védett endpointnál
      throw new ForbiddenException('Hiányzó tenant azonosító.');
    }

    if (tokenTenantId !== headerTenantId) {
      throw new ForbiddenException('A token tenantja nem egyezik a kért tenanttal.');
    }

    return true;
  }
}
