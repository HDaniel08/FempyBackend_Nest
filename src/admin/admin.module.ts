// src/admin/admin.module.ts

import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PositionsService } from '../positions/positions.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminPositionsController } from './admin-positions.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  controllers: [
    AdminUsersController,
    AdminPositionsController,
    AdminDashboardController,
    AdminSettingsController,
  ],
  providers: [
    PrismaService,
    UsersService,
    PositionsService,
    AdminDashboardService,
    AdminSettingsService,
  ],
})
export class AdminModule {}
