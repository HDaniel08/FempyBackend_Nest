import { Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { ActivityMaintenanceService } from './activity-maintenance.service';

@Module({
  providers: [ActivityLogService, ActivityMaintenanceService],
  exports: [ActivityLogService, ActivityMaintenanceService],
})
export class ActivityModule {}
