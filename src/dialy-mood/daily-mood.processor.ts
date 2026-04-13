import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('daily-mood')
export class DailyMoodProcessor extends WorkerHost {
  async process(job: Job) {
    // job.data = amit a queue-ba betettél
    // TODO: DB mentés
    return { ok: true };
  }
}