// src/admin/admin-dashboard.controller.ts

import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('summary')
  getSummary(
    @Req() req: any,
    @Query('range') range?: string,
    @Query('positionId') positionId?: string,
  ) {
    return this.dashboardService.getSummary(req.user.tenantId, {
      range: range ? Number(range) : 7,
      positionId: positionId || null,
    });
  }
}