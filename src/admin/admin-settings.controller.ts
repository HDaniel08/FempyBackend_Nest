// src/admin/admin-settings.controller.ts

import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminSettingsService } from './admin-settings.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  getSettings(@Req() req: any) {
    return this.settingsService.getSettings(req.user.tenantId);
  }

  @Patch()
  updateSettings(
    @Req() req: any,
    @Body()
    body: {
      orgName?: string;
      companyForm?: string;
      taxNumber?: string | null;
      companyAddress?: string | null;
      companyGoals?: string | null;

      notifyEmail?: boolean;
      notifyPush?: boolean;
      notifyWorkdayOnly?: boolean;

      defaultLang?: string;
      themeMode?: string;
      timeZone?: string;
    },
  ) {
    return this.settingsService.updateSettings(req.user.tenantId, body);
  }
}