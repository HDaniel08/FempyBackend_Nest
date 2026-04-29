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

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers(@Req() req: any) {
    return this.usersService.adminListUsers(req.user.tenantId);
  }

  @Post()
  createUser(
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
    return this.usersService.adminCreateUser(req.user.tenantId, body);
  }

  @Patch(':id')
  updateUser(
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
    return this.usersService.adminUpdateUser(req.user.tenantId, id, body);
  }

@Patch(':id/deactivate')
deactivateUser(@Req() req: any, @Param('id') id: string) {
  return this.usersService.adminSetUserDeleted(
    req.user.tenantId,
    id,
    true,
    req.user.sub,
  );
}

@Patch(':id/activate')
activateUser(@Req() req: any, @Param('id') id: string) {
  return this.usersService.adminSetUserDeleted(
    req.user.tenantId,
    id,
    false,
    req.user.sub,
  );
}

  @Patch(':id/position')
  assignPosition(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      positionId: string | null;
    },
  ) {
    return this.usersService.adminAssignUserPosition(
      req.user.tenantId,
      id,
      body.positionId ?? null,
    );
  }
}