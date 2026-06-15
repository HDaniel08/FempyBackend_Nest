import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkScheduleService } from './work-schedule.service';

const workDays = [
  { day: 'monday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'tuesday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'wednesday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'thursday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'friday', isRestDay: false, start: '08:00', end: '14:00' },
  { day: 'saturday', isRestDay: true, start: null, end: null },
  { day: 'sunday', isRestDay: true, start: null, end: null },
];

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkScheduleService,
        {
          provide: PrismaService,
          useValue: {
            organizationSettings: {
              findUnique: jest.fn().mockResolvedValue({
                workDays,
                timeZone: 'Europe/Budapest',
              }),
            },
          },
        },
      ],
    }).compile();

    service = module.get(WorkScheduleService);
  });

  it('blocks notifications before the configured start time', async () => {
    const status = await service.getStatus(
      'tenant-1',
      new Date('2026-06-15T05:30:00.000Z'),
    );

    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('before_work');
    expect(status.nextStart.toISOString()).toBe('2026-06-15T06:00:00.000Z');
  });

  it('allows notifications during the configured work period', async () => {
    const status = await service.getStatus(
      'tenant-1',
      new Date('2026-06-15T10:00:00.000Z'),
    );

    expect(status.allowed).toBe(true);
    expect(status.dateKey).toBe('2026-06-15');
  });

  it('moves Friday after work to the next Monday start', async () => {
    const status = await service.getStatus(
      'tenant-1',
      new Date('2026-06-19T13:00:00.000Z'),
    );

    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('after_work');
    expect(status.nextStart.toISOString()).toBe('2026-06-22T06:00:00.000Z');
  });
});
