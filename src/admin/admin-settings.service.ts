// src/admin/admin-settings.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}