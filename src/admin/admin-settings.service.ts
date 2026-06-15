// src/admin/admin-settings.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WORK_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      settings: tenant.settings,
    };
  }

  async updateSettings(
    tenantId: string,
    input: {
      orgName?: string;
      companyForm?: string;
      taxNumber?: string | null;
      companyAddress?: string | null;
      companyGoals?: string | null;

      notifyEmail?: boolean;
      notifyPush?: boolean;
      notifyWorkdayOnly?: boolean;
      workDays?: unknown;

      defaultLang?: string;
      themeMode?: string;
      timeZone?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const workDays =
      input.workDays === undefined
        ? undefined
        : this.validateWorkDays(input.workDays);

    const updated = await this.prisma.organizationSettings.upsert({
      where: { tenantId },
      update: {
        orgName: input.orgName,
        companyForm: input.companyForm,
        taxNumber: input.taxNumber,
        companyAddress: input.companyAddress,
        companyGoals: input.companyGoals,
        notifyEmail: input.notifyEmail,
        notifyPush: input.notifyPush,
        notifyWorkdayOnly: input.notifyWorkdayOnly,
        workDays,
        defaultLang: input.defaultLang,
        themeMode: input.themeMode,
        timeZone: input.timeZone,
      },
      create: {
        tenantId,
        orgName: input.orgName ?? tenant.name,
        companyForm: input.companyForm ?? '',
        taxNumber: input.taxNumber ?? null,
        companyAddress: input.companyAddress ?? null,
        companyGoals: input.companyGoals ?? null,
        notifyEmail: input.notifyEmail ?? false,
        notifyPush: input.notifyPush ?? false,
        notifyWorkdayOnly: input.notifyWorkdayOnly ?? false,
        workDays: workDays ?? this.defaultWorkDays(),
        defaultLang: input.defaultLang ?? 'hu',
        themeMode: input.themeMode ?? 'light',
        timeZone: input.timeZone ?? 'Europe/Budapest',
      },
    });

    if (input.orgName) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          name: input.orgName,
        },
      });
    }

    return updated;
  }

  private validateWorkDays(value: unknown): Prisma.InputJsonValue {
    if (!Array.isArray(value) || value.length !== WORK_DAY_KEYS.length) {
      throw new BadRequestException(
        'A munkarendnek hétfőtől vasárnapig mind a 7 napot tartalmaznia kell.',
      );
    }

    const rows = value.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException('Érvénytelen munkarend formátum.');
      }

      const row = item as Record<string, unknown>;
      const expectedDay = WORK_DAY_KEYS[index];
      if (row.day !== expectedDay) {
        throw new BadRequestException(
          'A munkarend napjai hétfőtől vasárnapig sorrendben szükségesek.',
        );
      }

      const isRestDay = row.isRestDay === true;
      const start = typeof row.start === 'string' ? row.start : '';
      const end = typeof row.end === 'string' ? row.end : '';

      if (!isRestDay) {
        if (!this.isValidTime(start) || !this.isValidTime(end)) {
          throw new BadRequestException(
            'A munkanapok kezdési és végzési ideje HH:mm formátumú legyen.',
          );
        }
        if (this.timeToMinutes(end) <= this.timeToMinutes(start)) {
          throw new BadRequestException(
            'A végzés időpontja későbbi legyen a kezdésnél.',
          );
        }
      }

      return {
        day: expectedDay,
        isRestDay,
        start: isRestDay ? null : start,
        end: isRestDay ? null : end,
      };
    });

    return rows as Prisma.InputJsonValue;
  }

  private defaultWorkDays(): Prisma.InputJsonValue {
    return WORK_DAY_KEYS.map((day, index) => ({
      day,
      isRestDay: index > 4,
      start: index > 4 ? null : '08:00',
      end: index > 4 ? null : '16:00',
    })) as Prisma.InputJsonValue;
  }

  private isValidTime(value: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
