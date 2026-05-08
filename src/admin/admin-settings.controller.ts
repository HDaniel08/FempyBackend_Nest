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
import { ActivityLogService } from '../activity/activity-log.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettingsController {
  constructor(
    private readonly settingsService: AdminSettingsService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  getSettings(@Req() req: any) {
    return this.settingsService.getSettings(req.user.tenantId);
  }

  @Patch()
  async updateSettings(
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
    const updated = await this.settingsService.updateSettings(req.user.tenantId, body);
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: req.user.sub,
      event: 'ADMIN_SETTINGS_UPDATED',
      source: 'admin',
      entityType: 'SETTINGS',
      entityId: req.user.tenantId,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { changed: Object.keys(body ?? {}) },
      request: this.activity.requestMeta(req),
    });
    return updated;
  }
}
