// src/admin/admin-users.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ActivityLogService } from '../activity/activity-log.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  listUsers(@Req() req: any) {
    return this.usersService.adminListUsers(req.user.tenantId);
  }

  @Get(':id/support')
  getUserSupport(@Req() req: any, @Param('id') id: string) {
    return this.usersService.adminGetUserSupport(req.user.tenantId, id);
  }

  @Post()
  async createUser(
    @Req() req: any,
    @Body()
    body: {
      email: string;
      temporaryPassword: string;
      firstName: string;
      lastName: string;
      role?: UserRole;
    },
  ) {
    const created = await this.usersService.adminCreateUser(req.user.tenantId, body);
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: created.id,
      event: 'ADMIN_USER_CREATED',
      source: 'admin',
      entityType: 'USER',
      entityId: created.id,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { email: created.email, role: created.role },
      request: this.activity.requestMeta(req),
    });
    return created;
  }

  @Patch(':id')
  async updateUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: UserRole;
    },
  ) {
    const updated = await this.usersService.adminUpdateUser(req.user.tenantId, id, body);
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: id,
      event: 'ADMIN_USER_UPDATED',
      source: 'admin',
      entityType: 'USER',
      entityId: id,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { changed: Object.keys(body ?? {}), email: updated.email, role: updated.role },
      request: this.activity.requestMeta(req),
    });
    return updated;
  }

  @Patch(':id/password')
  async setUserPassword(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      newPassword?: string;
      mustChangePassword?: boolean;
    },
  ) {
    const updated = await this.usersService.adminSetUserPassword(
      req.user.tenantId,
      id,
      body,
    );
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: id,
      event: 'ADMIN_USER_PASSWORD_CHANGED',
      source: 'admin',
      entityType: 'USER',
      entityId: id,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { email: updated.email, mustChangePassword: updated.mustChangePassword },
      request: this.activity.requestMeta(req),
    });
    return updated;
  }

@Patch(':id/deactivate')
async deactivateUser(@Req() req: any, @Param('id') id: string) {
  const updated = await this.usersService.adminSetUserDeleted(
    req.user.tenantId,
    id,
    true,
    req.user.sub,
  );
  await this.activity.log({
    tenantId: req.user.tenantId,
    userId: id,
    event: 'ADMIN_USER_DEACTIVATED',
    source: 'admin',
    entityType: 'USER',
    entityId: id,
    actor: { type: 'USER', id: req.user.sub },
    metadata: { email: updated.email, role: updated.role },
    request: this.activity.requestMeta(req),
  });
  return updated;
}

@Patch(':id/activate')
async activateUser(@Req() req: any, @Param('id') id: string) {
  const updated = await this.usersService.adminSetUserDeleted(
    req.user.tenantId,
    id,
    false,
    req.user.sub,
  );
  await this.activity.log({
    tenantId: req.user.tenantId,
    userId: id,
    event: 'ADMIN_USER_ACTIVATED',
    source: 'admin',
    entityType: 'USER',
    entityId: id,
    actor: { type: 'USER', id: req.user.sub },
    metadata: { email: updated.email, role: updated.role },
    request: this.activity.requestMeta(req),
  });
  return updated;
}

  @Patch(':id/position')
  async assignPosition(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      positionId: string | null;
    },
  ) {
    const updated = await this.usersService.adminAssignUserPosition(
      req.user.tenantId,
      id,
      body.positionId ?? null,
    );
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: id,
      event: 'ADMIN_USER_POSITION_ASSIGNED',
      source: 'admin',
      entityType: 'USER',
      entityId: id,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { positionId: body.positionId ?? null, positionName: updated.position?.name ?? null },
      request: this.activity.requestMeta(req),
    });
    return updated;
  }
}
