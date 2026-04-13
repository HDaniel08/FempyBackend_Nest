import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DailyMoodController } from './daily-mood.controller';
import { DailyMoodService } from './daily-mood.service';
import { DailyMoodProcessor } from './daily-mood.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'daily-mood',
    }),
  ],
  controllers: [DailyMoodController],
  providers: [DailyMoodService, DailyMoodProcessor],
})
export class DailyMoodModule {}