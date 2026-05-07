import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type PushFilters = {
  tenantId?: string;
  positionId?: string;
  role?: UserRole;
  isLeader?: boolean;
  appAccessEnabled?: boolean;
  hasDevice?: boolean;
  pendingDailyQuestion?: boolean;
  campaignKey?: string;
};

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  async login(input: { email: string; password: string }) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: input.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    const ok = await bcrypt.compare(input.password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Hibás email vagy jelszó.');

    const accessToken = await this.jwt.signAsync({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      scope: 'platform-admin',
    });

    return {
      accessToken,
      user: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  async me(adminId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, isActive: true },
    });
    if (!admin?.isActive) throw new UnauthorizedException();
    return admin;
  }

  listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        positions: {
          where: { isDeleted: false },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { users: true, devices: true, dailyQuestionDispatches: true } },
      },
    });
  }

  async createTenant(input: {
    tenantName: string;
    slug: string;
    adminEmail: string;
    adminName: string;
    adminPassword: string;
  }) {
    const name = input.tenantName?.trim();
    const slug = input.slug?.trim().toLowerCase();
    const email = input.adminEmail?.trim().toLowerCase();
    const adminName = input.adminName?.trim();

    if (!name || !slug || !email || !adminName || !input.adminPassword) {
      throw new BadRequestException('Minden mező kitöltése kötelező.');
    }

    const [firstName, ...rest] = adminName.split(/\s+/);
    const lastName = rest.join(' ') || 'Admin';
    const passwordHash = await bcrypt.hash(input.adminPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          appAccessEnabled: true,
          settings: {
            create: {
              orgName: name,
              companyForm: 'Kft',
              defaultLang: 'hu',
              themeMode: 'light',
              timeZone: 'Europe/Budapest',
            },
          },
        },
      });

      let root = await tx.position.findFirst({
        where: { tenantId: tenant.id, name: 'Root', parentId: null },
      });
      root ??= await tx.position.create({
        data: { tenantId: tenant.id, name: 'Root', parentId: null },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          firstName,
          lastName,
          role: UserRole.ADMIN,
          isLeader: true,
          positionId: root.id,
          profile: {
            create: {
              tenantId: tenant.id,
              nickname: firstName,
              isAnonymous: false,
              isPublic: true,
              dailyNotification: true,
              profilePic: '1',
            },
          },
        },
      });

      return { tenant, adminUser: user };
    });
  }

  updateTenantAccess(tenantId: string, enabled: boolean) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { appAccessEnabled: enabled },
    });
  }

  async listCampaigns() {
    const schedules = await this.prisma.dailyQuestionSchedule.findMany({
      where: { campaignKey: { not: null } },
      include: {
        tenant: true,
        question: { include: { topicRef: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const groups = new Map<string, any>();
    for (const schedule of schedules) {
      const key = `${schedule.tenantId ?? 'global'}::${schedule.campaignKey}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          tenantId: schedule.tenantId,
          tenantName: schedule.tenant?.name ?? 'Globális',
          campaignKey: schedule.campaignKey,
          name: schedule.name ?? schedule.campaignKey,
          topicName: schedule.question.topicRef?.name ?? schedule.question.topic,
          questionCount: 0,
          activeSchedules: 0,
        });
      }
      const group = groups.get(key);
      group.questionCount += 1;
      if (schedule.isActive) group.activeSchedules += 1;
    }

    const result: any[] = [];
    for (const group of groups.values()) {
      const [dispatchCount, filledCount] = await Promise.all([
        this.prisma.dailyQuestionDispatch.count({
          where: { tenantId: group.tenantId, campaignKey: group.campaignKey },
        }),
        this.prisma.dailyQuestionnaireAnswer.count({
          where: {
            tenantId: group.tenantId ?? undefined,
            filledAt: { not: null },
            dispatch: { campaignKey: group.campaignKey },
          },
        }),
      ]);
      result.push({ ...group, dispatchCount, filledCount });
    }

    return result;
  }

  async previewPush(filters: PushFilters) {
    const users = await this.resolvePushUsers(filters);
    return { count: users.length };
  }

  async sendPush(input: { title: string; body: string; filters: PushFilters }) {
    if (!input.title?.trim() || !input.body?.trim()) {
      throw new BadRequestException('A cím és szöveg kötelező.');
    }

    const users = await this.resolvePushUsers(input.filters ?? {});
    const jobs: any[] = [];
    for (const user of users) {
      jobs.push(
        await this.notifications.sendNow({
          tenantId: user.tenantId,
          userId: user.id,
          type: 'platform_push',
          payload: { title: input.title, body: input.body },
        }),
      );
    }

    return { targetedUsers: users.length, queuedJobs: jobs.length };
  }

  private async resolvePushUsers(filters: PushFilters) {
    const where: any = { isDeleted: false };
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.positionId) where.positionId = filters.positionId;
    if (filters.role) where.role = filters.role;
    if (typeof filters.isLeader === 'boolean') where.isLeader = filters.isLeader;
    if (typeof filters.appAccessEnabled === 'boolean') {
      where.tenant = { appAccessEnabled: filters.appAccessEnabled };
    }
    if (filters.hasDevice) {
      where.devices = { some: {} };
    }
    if (typeof filters.pendingDailyQuestion === 'boolean') {
      where.answers = filters.pendingDailyQuestion
        ? { some: { filledAt: null, isActive: true } }
        : { none: { filledAt: null, isActive: true } };
    }
    if (filters.campaignKey) {
      where.answers = {
        some: {
          dispatch: { campaignKey: filters.campaignKey },
        },
      };
    }

    return this.prisma.user.findMany({
      where,
      select: { id: true, tenantId: true },
    });
  }
}
