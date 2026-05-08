import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivityLogService } from './activity-log.service';
import { ActivityMaintenanceService } from './activity-maintenance.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ActivityLogService, ActivityMaintenanceService],
  exports: [ActivityLogService, ActivityMaintenanceService],
})
export class ActivityModule {}
