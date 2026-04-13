import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * TenantDecorator:
 * - Kényelmesen ki tudjuk szedni a middleware által beállított `req.tenant` értéket.
 * - Így a controllerben nem kell a teljes requestet bogarászni.
 */
export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.tenant; // Tenant rekord Prisma-ból
});