import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSettingsService } from './admin-settings.service';

const validWorkDays = [
  { day: 'monday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'tuesday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'wednesday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'thursday', isRestDay: false, start: '08:00', end: '16:00' },
  { day: 'friday', isRestDay: false, start: '08:00', end: '14:00' },
  { day: 'saturday', isRestDay: true, start: '', end: '' },
  { day: 'sunday', isRestDay: true, start: '', end: '' },
];

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let prisma: {
    tenant: { findUnique: jest.Mock; update: jest.Mock };
    organizationSettings: { upsert: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'tenant-1', name: 'Teszt Kft.' }),
        update: jest.fn(),
      },
      organizationSettings: {
        upsert: jest.fn().mockImplementation(({ update }) => update),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AdminSettingsService);
  });

  it('normalizes rest days and saves a complete weekly schedule', async () => {
    await service.updateSettings('tenant-1', { workDays: validWorkDays });

    expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          workDays: expect.arrayContaining([
            {
              day: 'saturday',
              isRestDay: true,
              start: null,
              end: null,
            },
          ]),
        }),
      }),
    );
  });

  it('rejects work days where the end is not after the start', async () => {
    const invalid = validWorkDays.map((item) =>
      item.day === 'monday'
        ? { ...item, start: '16:00', end: '08:00' }
        : item,
    );

    await expect(
      service.updateSettings('tenant-1', { workDays: invalid }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects incomplete weekly schedules', async () => {
    await expect(
      service.updateSettings('tenant-1', {
        workDays: validWorkDays.slice(0, 6),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
