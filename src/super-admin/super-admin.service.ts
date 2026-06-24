import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync } from 'fs';
import { join } from 'path';
import type Mail from 'nodemailer/lib/mailer';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { ActivityMaintenanceService } from '../activity/activity-maintenance.service';
import { ContentService } from '../content/content.service';
import { UsageService } from '../usage/usage.service';
import { MailService } from '../mail/mail.service';
import { AppVersionService } from '../app-version/app-version.service';
import Redis from 'ioredis';
import {
  buildRedisConnectionOptions,
  describeRedisConnection,
} from '../notifications/redis-connection.config';

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

const IOS_APP_STORE_URL = 'https://apps.apple.com/hu/app/fempy/id6762603045';
const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.fempy.rework.app';
const LINKEDIN_URL = 'https://www.linkedin.com/company/fempy';
const CONTACT_EMAIL = 'info@fempy.hu';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityLogService,
    private readonly activityMaintenance: ActivityMaintenanceService,
    private readonly content: ContentService,
    private readonly usage: UsageService,
    private readonly mail: MailService,
    private readonly appVersion: AppVersionService,
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

  getAppVersionPolicy() {
    return this.appVersion.getPolicy();
  }

  updateAppVersionPolicy(input: Record<string, any>) {
    return this.appVersion.updatePolicy(input);
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        positions: {
          where: { isDeleted: false },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { users: true, devices: true, dailyQuestionDispatches: true },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return Promise.all(
      tenants.map(async (tenant) => {
        const [
          lastAdminLogin,
          lastAppActivity,
          activeDevices,
          todayUsage,
          pendingDispatches,
          failedNotificationJobs,
        ] = await Promise.all([
          this.prisma.activityEvent.findFirst({
            where: {
              tenantId: tenant.id,
              event: 'AUTH_LOGIN_SUCCEEDED',
              user: { role: UserRole.ADMIN },
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
          this.prisma.activityEvent.findFirst({
            where: { tenantId: tenant.id, category: 'APP' },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
          this.prisma.userDevice.count({
            where: {
              tenantId: tenant.id,
              OR: [{ lastSeenAt: { gte: activeSince } }, { lastSeenAt: null }],
            },
          }),
          this.prisma.appUsageSession.aggregate({
            where: { tenantId: tenant.id, startedAt: { gte: today } },
            _sum: { durationSeconds: true },
          }),
          this.prisma.dailyQuestionDispatch.count({
            where: { tenantId: tenant.id, answers: { none: {} } },
          }),
          this.prisma.notificationJob.count({
            where: { tenantId: tenant.id, status: { in: ['failed', 'error'] } },
          }),
        ]);

        return {
          ...tenant,
          health: {
            lastAdminLoginAt: lastAdminLogin?.createdAt ?? null,
            lastAppActivityAt: lastAppActivity?.createdAt ?? null,
            activeDevices,
            todayUsageSeconds: todayUsage._sum.durationSeconds ?? 0,
            pendingDispatches,
            failedNotificationJobs,
          },
        };
      }),
    );
  }

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      tenants,
      activeUsers,
      todayActiveUsers,
      todayUsage,
      recentImpersonations,
      criticalAlerts,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.appUsageSession.groupBy({
        by: ['userId'],
        where: { lastSeenAt: { gte: activeSince } },
      }),
      this.prisma.appUsageSession.aggregate({
        where: { startedAt: { gte: today } },
        _sum: { durationSeconds: true },
      }),
      this.prisma.activityEvent.findMany({
        where: { event: 'SUPER_ADMIN_TENANT_IMPERSONATION_STARTED' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          tenant: { select: { name: true, slug: true } },
          user: { select: { email: true } },
        },
      }),
      this.prisma.notificationJob.findMany({
        where: { status: { in: ['failed', 'error'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { tenant: { select: { name: true, slug: true } } },
      }),
    ]);

    return {
      stats: {
        tenants,
        activeUsers,
        todayActiveAppUsers: todayActiveUsers.length,
        todayUsageSeconds: todayUsage._sum.durationSeconds ?? 0,
      },
      recentImpersonations,
      criticalAlerts: criticalAlerts.map((job) => ({
        id: job.id,
        title: 'Sikertelen notification job',
        tenant: job.tenant,
        detail: job.errorMessage ?? job.type,
        createdAt: job.createdAt,
      })),
    };
  }

  async listPlatformAudit(query: any) {
    const where: any = {};
    if (query?.tenantId) where.tenantId = String(query.tenantId);
    if (query?.event)
      where.event = { contains: String(query.event), mode: 'insensitive' };
    if (query?.category) where.category = String(query.category);
    const limit = Math.min(Number(query?.limit ?? 100), 300);

    return this.prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async createTenant(
    input: {
      tenantName: string;
      slug: string;
      adminEmail: string;
      adminName: string;
      adminPassword: string;
    },
    actor?: any,
    req?: any,
  ) {
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

    const result = await this.prisma.$transaction(async (tx) => {
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
          mustChangePassword: true,
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

    await this.activity.log({
      tenantId: result.tenant.id,
      userId: result.adminUser.id,
      event: 'SUPER_ADMIN_TENANT_CREATED',
      source: 'super-admin',
      entityType: 'TENANT',
      entityId: result.tenant.id,
      actor: { type: 'PLATFORM_ADMIN', id: actor?.sub ?? null },
      metadata: {
        tenantName: result.tenant.name,
        slug: result.tenant.slug,
        adminEmail: result.adminUser.email,
      },
      request: this.activity.requestMeta(req),
    });

    await this.sendTenantWelcomeEmail({
      adminName,
      email,
      password: input.adminPassword,
      tenantName: result.tenant.name,
    });

    return result;
  }

  async sendTestEmail(
    input: { email: string; name?: string },
    actor?: any,
    req?: any,
  ) {
    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim() || 'Teszt felhasználó';

    if (!email) {
      throw new BadRequestException('Email cím megadása kötelező.');
    }

    const appDownloadUrl =
      this.config.get<string>('APP_DOWNLOAD_URL') ??
      'https://fempyadmin.pages.dev/';
    const adminWebUrl =
      this.config.get<string>('ADMIN_WEB_URL') ??
      this.config.get<string>('PUBLIC_BASE_URL') ??
      'https://fempyapp.com';
    const logoPath = this.resolveMailLogoPath();
    const mailAttachments = this.buildMailAssetAttachments(logoPath);

    await this.mail.sendMail({
      to: { email, name },
      subject: 'Fempy - Teszt email',
      html: this.buildTestEmailHtml({
        name,
        iosAppStoreUrl: IOS_APP_STORE_URL,
        androidPlayStoreUrl: ANDROID_PLAY_STORE_URL,
        adminWebUrl,
        hasLogo: !!logoPath,
      }),
      text: `Kedves ${name}!

Ez egy Fempy teszt email. Ha ezt az üzenetet megkaptad, az email szolgáltatás működik.

Alkalmazás: ${appDownloadUrl}
iOS App Store: ${IOS_APP_STORE_URL}
Android Play Áruház: ${ANDROID_PLAY_STORE_URL}
Webes felület: ${adminWebUrl}

Fempy csapata${this.buildMailTextFooter()}`,
      attachments: mailAttachments.length ? mailAttachments : undefined,
    });

    this.logger.log(
      `Superadmin test email sent to ${email} by ${actor?.email ?? actor?.sub ?? 'unknown'}`,
    );

    return { ok: true };
  }

  async updateTenantAccess(
    tenantId: string,
    enabled: boolean,
    actor?: any,
    req?: any,
  ) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { appAccessEnabled: enabled },
    });

    await this.activity.log({
      tenantId,
      event: enabled
        ? 'SUPER_ADMIN_TENANT_APP_ENABLED'
        : 'SUPER_ADMIN_TENANT_APP_DISABLED',
      source: 'super-admin',
      entityType: 'TENANT',
      entityId: tenantId,
      actor: { type: 'PLATFORM_ADMIN', id: actor?.sub ?? null },
      supportSessionId: await this.resolveSupportSessionId(
        tenantId,
        actor?.sub,
        req,
      ),
      metadata: { enabled, tenantName: tenant.name, slug: tenant.slug },
      request: this.activity.requestMeta(req),
    });

    return tenant;
  }

  async startTenantImpersonation(
    tenantId: string,
    input: { reason?: string },
    actor?: any,
    req?: any,
  ) {
    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Support ok megadása kötelező.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        appAccessEnabled: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant nem található.');

    const adminUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        role: UserRole.ADMIN,
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isLeader: true,
      },
    });
    if (!adminUser) {
      throw new BadRequestException(
        'A tenantban nincs aktív admin felhasználó.',
      );
    }

    const accessToken = await this.jwt.signAsync({
      sub: adminUser.id,
      tenantId: tenant.id,
      email: adminUser.email,
      isLeader: adminUser.isLeader,
      role: adminUser.role,
      impersonated: true,
      impersonatedByPlatformAdminId: actor?.sub ?? null,
      impersonatedByPlatformAdminEmail: actor?.email ?? null,
      impersonationReason: reason,
      scope: 'tenant-admin-impersonation',
    });

    await this.activity.log({
      tenantId,
      userId: adminUser.id,
      event: 'SUPER_ADMIN_TENANT_IMPERSONATION_STARTED',
      source: 'super-admin',
      entityType: 'TENANT',
      entityId: tenantId,
      actor: { type: 'PLATFORM_ADMIN', id: actor?.sub ?? null },
      metadata: {
        reason,
        tenantName: tenant.name,
        platformAdminEmail: actor?.email ?? null,
        impersonatedUserEmail: adminUser.email,
      },
      request: this.activity.requestMeta(req),
    });

    return {
      accessToken,
      user: {
        id: adminUser.id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.email,
        isLeader: adminUser.isLeader,
        role: adminUser.role,
      },
      tenant,
      impersonation: {
        active: true,
        reason,
        startedAt: new Date().toISOString(),
        platformAdmin: {
          id: actor?.sub ?? null,
          email: actor?.email ?? null,
          name: actor?.name ?? null,
        },
      },
    };
  }

  async endTenantImpersonation(
    tenantId: string,
    input: { reason?: string },
    actor?: any,
    req?: any,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant nem található.');

    await this.activity.log({
      tenantId,
      event: 'SUPER_ADMIN_TENANT_IMPERSONATION_ENDED',
      source: 'super-admin',
      entityType: 'TENANT',
      entityId: tenantId,
      actor: { type: 'PLATFORM_ADMIN', id: actor?.sub ?? null },
      metadata: {
        tenantName: tenant.name,
        slug: tenant.slug,
        reason: input.reason ?? null,
        platformAdminEmail: actor?.email ?? null,
      },
      request: this.activity.requestMeta(req),
    });

    return { ok: true };
  }

  async inspectTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        settings: true,
        _count: {
          select: {
            users: true,
            positions: true,
            devices: true,
            dailyQuestionSchedules: true,
            dailyQuestionDispatches: true,
            dailyQuestionAnswers: true,
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant nem található.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 29);

    const [
      activeUsers,
      inactiveUsers,
      adminUsers,
      leaderUsers,
      users,
      positions,
      moodStats,
      todayMoods,
      pendingAnswers,
      recentMoods,
      recentDispatches,
      notificationJobs,
      campaignGroups,
      recentActivity,
      supportSessions,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, isDeleted: false } }),
      this.prisma.user.count({ where: { tenantId, isDeleted: true } }),
      this.prisma.user.count({
        where: { tenantId, role: UserRole.ADMIN, isDeleted: false },
      }),
      this.prisma.user.count({
        where: { tenantId, isLeader: true, isDeleted: false },
      }),
      this.prisma.user.findMany({
        where: { tenantId },
        orderBy: [{ isDeleted: 'asc' }, { updatedAt: 'desc' }],
        take: 80,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isLeader: true,
          isDeleted: true,
          createdAt: true,
          updatedAt: true,
          positionId: true,
          position: { select: { id: true, name: true } },
          profile: {
            select: {
              nickname: true,
              isAnonymous: true,
              isPublic: true,
              onHoliday: true,
              dailyNotification: true,
            },
          },
          _count: {
            select: {
              devices: true,
              moods: true,
              answers: true,
              notifJobs: true,
            },
          },
        },
      }),
      this.prisma.position.findMany({
        where: { tenantId, isDeleted: false },
        orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          parentId: true,
          _count: { select: { users: true } },
        },
      }),
      this.prisma.dailyMood.aggregate({
        where: { tenantId, date: { gte: last30Days } },
        _avg: { mood: true },
        _count: { mood: true },
      }),
      this.prisma.dailyMood.count({ where: { tenantId, date: today } }),
      this.prisma.dailyQuestionnaireAnswer.count({
        where: { tenantId, filledAt: null, isActive: true },
      }),
      this.prisma.dailyMood.findMany({
        where: { tenantId },
        orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
        take: 20,
        select: {
          id: true,
          date: true,
          mood: true,
          comment: true,
          updatedAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.dailyQuestionDispatch.findMany({
        where: { tenantId },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: {
          id: true,
          campaignKey: true,
          sentOn: true,
          sentAt: true,
          audienceType: true,
          pushSent: true,
          question: { select: { id: true, topic: true, question: true } },
          _count: { select: { answers: true } },
        },
      }),
      this.prisma.notificationJob.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          errorMessage: true,
          scheduledFor: true,
          createdAt: true,
          processedAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.dailyQuestionSchedule.groupBy({
        by: ['campaignKey'],
        where: { tenantId, campaignKey: { not: null } },
        _count: { id: true },
      }),
      this.prisma.activityEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.supportSession.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: 12,
        include: {
          platformAdmin: { select: { id: true, name: true, email: true } },
          _count: { select: { activities: true } },
        },
      }),
    ]);

    return {
      tenant,
      overview: {
        users: {
          active: activeUsers,
          inactive: inactiveUsers,
          total: activeUsers + inactiveUsers,
          admins: adminUsers,
          leaders: leaderUsers,
        },
        positions: positions.length,
        devices: tenant._count.devices,
        dailyMood: {
          todayAnswers: todayMoods,
          last30DaysAnswers: moodStats._count.mood,
          last30DaysAverage: moodStats._avg.mood
            ? Number(moodStats._avg.mood.toFixed(2))
            : null,
        },
        dailyQuestions: {
          schedules: tenant._count.dailyQuestionSchedules,
          dispatches: tenant._count.dailyQuestionDispatches,
          answers: tenant._count.dailyQuestionAnswers,
          pendingAnswers,
          campaigns: campaignGroups.length,
        },
      },
      users,
      positions,
      recentMoods,
      recentDispatches,
      notificationJobs,
      recentActivity,
      supportSessions,
      campaigns: campaignGroups.map((group) => ({
        campaignKey: group.campaignKey,
        scheduleCount: group._count.id,
      })),
    };
  }

  async updateTenantUser(
    tenantId: string,
    userId: string,
    input: {
      role?: UserRole;
      isLeader?: boolean;
      isDeleted?: boolean;
      positionId?: string | null;
    },
    actor?: any,
    req?: any,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User nem található.');

    const data: any = {};

    if (input.role !== undefined) {
      if (!Object.values(UserRole).includes(input.role)) {
        throw new BadRequestException('Érvénytelen szerepkör.');
      }

      if (user.role === UserRole.ADMIN && input.role !== UserRole.ADMIN) {
        await this.assertTenantKeepsAdmin(tenantId, userId);
      }

      data.role = input.role;
      data.isLeader = input.role === UserRole.LEADER ? true : input.isLeader;
    }

    if (input.isLeader !== undefined && input.role === undefined) {
      data.isLeader = !!input.isLeader;
    }

    if (input.isDeleted !== undefined) {
      if (input.isDeleted && user.role === UserRole.ADMIN) {
        await this.assertTenantKeepsAdmin(tenantId, userId);
      }
      data.isDeleted = !!input.isDeleted;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'positionId')) {
      if (input.positionId) {
        const position = await this.prisma.position.findFirst({
          where: { id: input.positionId, tenantId, isDeleted: false },
          select: { id: true },
        });
        if (!position) throw new BadRequestException('Érvénytelen pozíció.');
      }
      data.positionId = input.positionId ?? null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nincs módosítandó adat.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isLeader: true,
        isDeleted: true,
        updatedAt: true,
        positionId: true,
        position: { select: { id: true, name: true } },
      },
    });

    await this.activity.log({
      tenantId,
      userId,
      event: 'SUPER_ADMIN_USER_UPDATED',
      source: 'super-admin',
      entityType: 'USER',
      entityId: userId,
      actor: { type: 'PLATFORM_ADMIN', id: actor?.sub ?? null },
      supportSessionId: await this.resolveSupportSessionId(
        tenantId,
        actor?.sub,
        req,
      ),
      metadata: {
        changed: Object.keys(data),
        before: {
          role: user.role,
          isLeader: user.isLeader,
          isDeleted: user.isDeleted,
          positionId: user.positionId,
        },
        after: {
          role: updated.role,
          isLeader: updated.isLeader,
          isDeleted: updated.isDeleted,
          positionId: updated.positionId,
        },
      },
      request: this.activity.requestMeta(req),
    });

    return updated;
  }

  async listTenantActivity(tenantId: string, query: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant nem található.');

    const maxLimit = query?._export ? 1000 : 200;
    const limit = Math.min(Math.max(Number(query?.limit ?? 80), 1), maxLimit);
    const where: any = { tenantId };
    if (query?.event) where.event = String(query.event);
    if (query?.category) where.category = String(query.category);
    if (query?.userId) where.userId = String(query.userId);
    if (query?.entityType) where.entityType = String(query.entityType);
    if (query?.entityId) where.entityId = String(query.entityId);
    if (query?.supportSessionId)
      where.supportSessionId = String(query.supportSessionId);
    if (query?.from || query?.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    return this.prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        supportSession: {
          include: {
            platformAdmin: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  async exportTenantActivityCsv(tenantId: string, query: any) {
    const rows = await this.listTenantActivity(tenantId, {
      ...query,
      limit: query?.limit ?? 1000,
      _export: true,
    });

    const header = [
      'createdAt',
      'category',
      'event',
      'source',
      'user',
      'userEmail',
      'entityType',
      'entityId',
      'supportSessionId',
      'supportAdmin',
      'ipAddress',
      'metadata',
    ];

    const lines = rows.map((row: any) => [
      row.createdAt?.toISOString?.() ?? row.createdAt,
      row.category,
      row.event,
      row.source,
      row.user ? `${row.user.lastName} ${row.user.firstName}` : '',
      row.user?.email ?? '',
      row.entityType ?? '',
      row.entityId ?? '',
      row.supportSessionId ?? '',
      row.supportSession?.platformAdmin?.email ?? '',
      row.ipAddress ?? '',
      JSON.stringify(row.metadata ?? {}),
    ]);

    return [header, ...lines]
      .map((line) => line.map((cell) => this.csvCell(cell)).join(','))
      .join('\n');
  }

  async startSupportSession(
    tenantId: string,
    input: { reason?: string },
    actor: any,
    req?: any,
  ) {
    await this.ensureTenant(tenantId);

    const session = await this.prisma.supportSession.create({
      data: {
        tenantId,
        platformAdminId: actor.sub,
        reason: input.reason?.trim() || null,
      },
      include: {
        platformAdmin: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true } },
      },
    });

    await this.activity.log({
      tenantId,
      event: 'SUPER_ADMIN_SUPPORT_SESSION_STARTED',
      source: 'super-admin',
      entityType: 'SUPPORT_SESSION',
      entityId: session.id,
      supportSessionId: session.id,
      actor: { type: 'PLATFORM_ADMIN', id: actor.sub },
      metadata: { reason: session.reason },
      request: this.activity.requestMeta(req),
    });

    return session;
  }

  async closeSupportSession(
    tenantId: string,
    sessionId: string,
    actor: any,
    req?: any,
  ) {
    const session = await this.prisma.supportSession.findFirst({
      where: { id: sessionId, tenantId, platformAdminId: actor.sub },
    });
    if (!session) throw new NotFoundException('Support session nem található.');

    const closed = await this.prisma.supportSession.update({
      where: { id: sessionId },
      data: { status: 'closed', endedAt: new Date() },
      include: {
        platformAdmin: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true } },
      },
    });

    await this.activity.log({
      tenantId,
      event: 'SUPER_ADMIN_SUPPORT_SESSION_CLOSED',
      source: 'super-admin',
      entityType: 'SUPPORT_SESSION',
      entityId: sessionId,
      supportSessionId: sessionId,
      actor: { type: 'PLATFORM_ADMIN', id: actor.sub },
      metadata: { reason: session.reason },
      request: this.activity.requestMeta(req),
    });

    return closed;
  }

  async listSupportSessions(tenantId: string) {
    await this.ensureTenant(tenantId);
    return this.prisma.supportSession.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        platformAdmin: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true } },
      },
    });
  }

  async getTenantActivityDashboard(tenantId: string, query: any) {
    await this.ensureTenant(tenantId);
    const days = Math.min(Math.max(Number(query?.days ?? 30), 1), 90);
    const since = this.daysAgo(days - 1);

    const [byCategory, byEvent, recentUsers, activeUsers, timelineRows] =
      await Promise.all([
        this.prisma.activityEvent.groupBy({
          by: ['category'],
          where: { tenantId, createdAt: { gte: since } },
          _count: { id: true },
        }),
        this.prisma.activityEvent.groupBy({
          by: ['event'],
          where: { tenantId, createdAt: { gte: since } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 12,
        }),
        this.prisma.activityEvent.findMany({
          where: { tenantId, userId: { not: null }, createdAt: { gte: since } },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.user.count({ where: { tenantId, isDeleted: false } }),
        this.prisma.activityEvent.findMany({
          where: { tenantId, createdAt: { gte: since } },
          select: { createdAt: true, category: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const timeline = this.reduceDailyTimeline(timelineRows, days);

    return {
      range: { days, since },
      totals: {
        events: timelineRows.length,
        activeUsers,
        activeUsersWithActivity: recentUsers.length,
      },
      byCategory: byCategory.map((row) => ({
        category: row.category,
        count: row._count.id,
      })),
      topEvents: byEvent.map((row) => ({
        event: row.event,
        count: row._count.id,
      })),
      timeline,
    };
  }

  async getTenantActivityAlerts(tenantId: string) {
    await this.ensureTenant(tenantId);
    const oneHourAgo = this.hoursAgo(1);
    const dayAgo = this.hoursAgo(24);

    const [
      failedLogins,
      notificationErrors,
      appAccessDisabled,
      supportSessions,
    ] = await Promise.all([
      this.prisma.activityEvent.count({
        where: {
          tenantId,
          event: 'AUTH_LOGIN_FAILED',
          createdAt: { gte: oneHourAgo },
        },
      }),
      this.prisma.notificationJob.count({
        where: {
          tenantId,
          status: 'failed',
          createdAt: { gte: oneHourAgo },
        },
      }),
      this.prisma.activityEvent.count({
        where: {
          tenantId,
          event: 'SUPER_ADMIN_TENANT_APP_DISABLED',
          createdAt: { gte: dayAgo },
        },
      }),
      this.prisma.supportSession.count({
        where: {
          tenantId,
          status: 'active',
          startedAt: { lt: this.hoursAgo(8) },
        },
      }),
    ]);

    return [
      {
        id: 'failed-logins',
        severity:
          failedLogins >= 10
            ? 'critical'
            : failedLogins >= 5
              ? 'warning'
              : 'ok',
        title: 'Sikertelen belépések',
        value: failedLogins,
        detail: 'Az utolsó 1 órában.',
      },
      {
        id: 'notification-errors',
        severity:
          notificationErrors >= 5
            ? 'critical'
            : notificationErrors > 0
              ? 'warning'
              : 'ok',
        title: 'Értesítési hibák',
        value: notificationErrors,
        detail: 'Sikertelen értesítési feladatok az utolsó 1 órában.',
      },
      {
        id: 'app-disabled',
        severity: appAccessDisabled > 0 ? 'warning' : 'ok',
        title: 'App hozzáférés tiltása',
        value: appAccessDisabled,
        detail: 'Az utolsó 24 órában.',
      },
      {
        id: 'long-support-session',
        severity: supportSessions > 0 ? 'warning' : 'ok',
        title: 'Hosszú support session',
        value: supportSessions,
        detail: '8 óránál régebbi aktív session.',
      },
    ];
  }

  cleanupActivityRetention(input: {
    appDays?: number;
    auditDays?: number;
    systemDays?: number;
  }) {
    return this.activityMaintenance.cleanup(input);
  }

  async getRedisHealth() {
    const connection = buildRedisConnectionOptions(this.config);
    const startedAt = Date.now();
    const redis = new Redis({
      ...connection,
      lazyConnect: true,
      retryStrategy: () => null,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      return {
        ok: pong === 'PONG',
        pong,
        durationMs: Date.now() - startedAt,
        connection: describeRedisConnection(this.config, connection),
      };
    } catch (error) {
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        connection: describeRedisConnection(this.config, connection),
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                code: (error as any).code,
              }
            : { message: String(error) },
      };
    } finally {
      redis.disconnect();
    }
  }

  listContentSurfaces() {
    return this.content.listSurfaces();
  }

  listContentTopics() {
    return this.content.listTopics();
  }

  createContentTopic(input: any) {
    return this.content.createTopic(input);
  }

  updateContentTopic(id: string, input: any) {
    return this.content.updateTopic(id, input);
  }

  archiveContentTopic(id: string) {
    return this.content.archiveTopic(id);
  }

  listContentItems(query: any) {
    return this.content.listAll(query);
  }

  createContentItem(input: any) {
    return this.content.createItem(input);
  }

  updateContentItem(id: string, input: any) {
    return this.content.updateItem(id, input);
  }

  archiveContentItem(id: string) {
    return this.content.archiveItem(id);
  }

  deleteContentItem(id: string) {
    return this.content.deleteItem(id);
  }

  getTenantUsage(tenantId: string, query: any) {
    return this.usage.getTenantSummary(tenantId, Number(query?.days ?? 7));
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
          topicName:
            schedule.question.topicRef?.name ?? schedule.question.topic,
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

  async sendPush(
    input: { title: string; body: string; filters: PushFilters },
    actor?: any,
    req?: any,
  ) {
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

    const tenantIds = [...new Set(users.map((user) => user.tenantId))];
    for (const tenantId of tenantIds) {
      await this.activity.log({
        tenantId,
        event: 'SUPER_ADMIN_PUSH_SENT',
        source: 'super-admin',
        entityType: 'PUSH',
        entityId: null,
        actor: { type: 'PLATFORM_ADMIN', id: actor?.sub ?? null },
        supportSessionId: await this.resolveSupportSessionId(
          tenantId,
          actor?.sub,
          req,
        ),
        metadata: {
          title: input.title,
          filters: input.filters ?? {},
          targetedUsers: users.filter((user) => user.tenantId === tenantId)
            .length,
        },
        request: this.activity.requestMeta(req),
      });
    }

    return { targetedUsers: users.length, queuedJobs: jobs.length };
  }

  async triggerBullmqTest(input: { delayMs?: number }, actor?: any) {
    const tenant = await this.prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new BadRequestException(
        'BullMQ teszthez legalább egy tenant szükséges.',
      );
    }

    const job = await this.notifications.scheduleBullmqHealthCheck({
      tenantId: tenant.id,
      delayMs: input.delayMs,
      requestedBy: actor?.sub ?? actor?.email ?? null,
    });

    return { tenant, job };
  }

  async getBullmqTestStatus(jobId: string) {
    return this.prisma.notificationJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        tenantId: true,
        type: true,
        status: true,
        errorMessage: true,
        payload: true,
        scheduledFor: true,
        createdAt: true,
        processedAt: true,
      },
    });
  }

  private async resolvePushUsers(filters: PushFilters) {
    const where: any = { isDeleted: false };
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.positionId) where.positionId = filters.positionId;
    if (filters.role) where.role = filters.role;
    if (typeof filters.isLeader === 'boolean')
      where.isLeader = filters.isLeader;
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

  private async resolveSupportSessionId(
    tenantId: string,
    adminId?: string,
    req?: any,
  ) {
    const sessionId = req?.headers?.['x-support-session-id'];
    if (!sessionId || !adminId) return null;

    const session = await this.prisma.supportSession.findFirst({
      where: {
        id: String(sessionId),
        tenantId,
        platformAdminId: adminId,
        status: 'active',
      },
      select: { id: true },
    });

    return session?.id ?? null;
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant nem található.');
    return tenant;
  }

  private csvCell(value: any) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private hoursAgo(hours: number) {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date;
  }

  private reduceDailyTimeline(
    rows: Array<{ createdAt: Date; category: string }>,
    days: number,
  ) {
    const map = new Map<string, any>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = this.daysAgo(i).toISOString().slice(0, 10);
      map.set(date, { date, total: 0, AUDIT: 0, APP: 0, SYSTEM: 0 });
    }

    for (const row of rows) {
      const date = row.createdAt.toISOString().slice(0, 10);
      const item = map.get(date);
      if (!item) continue;
      item.total += 1;
      item[row.category] = (item[row.category] ?? 0) + 1;
    }

    return [...map.values()];
  }

  private async assertTenantKeepsAdmin(
    tenantId: string,
    excludedUserId: string,
  ) {
    const activeAdminCount = await this.prisma.user.count({
      where: {
        tenantId,
        role: UserRole.ADMIN,
        isDeleted: false,
        id: { not: excludedUserId },
      },
    });

    if (activeAdminCount < 1) {
      throw new BadRequestException(
        'Az utolsó aktív adminisztrátor nem módosítható.',
      );
    }
  }

  private async sendTenantWelcomeEmail(input: {
    adminName: string;
    email: string;
    password: string;
    tenantName: string;
  }) {
    try {
      const appDownloadUrl =
        this.config.get<string>('APP_DOWNLOAD_URL') ??
        'https://fempyadmin.pages.dev/';
      const adminWebUrl =
        this.config.get<string>('ADMIN_WEB_URL') ??
        this.config.get<string>('PUBLIC_BASE_URL') ??
        'https://fempyapp.com';
      const logoPath = this.resolveMailLogoPath();
      const mailAttachments = [
        ...this.buildMailAssetAttachments(logoPath),
        ...this.buildManualAttachments([
          {
            filename: 'felhasznaloi-kezikonyv-admin.pdf',
            fallbackName: 'Fempy-admin-kezikonyv.pdf',
          },
          {
            filename: 'felhasznaloi-kezikonyv-mobilapp.pdf',
            fallbackName: 'Fempy-mobilapp-kezikonyv.pdf',
          },
        ]),
      ];

      await this.mail.sendMail({
        to: { email: input.email, name: input.adminName },
        subject: 'Fempy - Hozzáférés az ingyenes tesztidőszakhoz',
        html: this.buildTenantWelcomeEmailHtml({
          adminName: input.adminName,
          email: input.email,
          password: input.password,
          iosAppStoreUrl: IOS_APP_STORE_URL,
          androidPlayStoreUrl: ANDROID_PLAY_STORE_URL,
          adminWebUrl,
          tenantName: input.tenantName,
          hasLogo: !!logoPath,
        }),
        text: this.buildTenantWelcomeEmailText({
          adminName: input.adminName,
          email: input.email,
          password: input.password,
          appDownloadUrl,
          iosAppStoreUrl: IOS_APP_STORE_URL,
          androidPlayStoreUrl: ANDROID_PLAY_STORE_URL,
          adminWebUrl,
        }),
        attachments: mailAttachments.length ? mailAttachments : undefined,
      });
    } catch (error) {
      this.logger.error(
        'Tenant welcome email sending failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildTestEmailHtml(input: {
    name: string;
    iosAppStoreUrl: string;
    androidPlayStoreUrl: string;
    adminWebUrl: string;
    hasLogo: boolean;
  }) {
    const name = this.escapeHtml(input.name);
    const iosAppStoreUrl = this.escapeHtml(input.iosAppStoreUrl);
    const androidPlayStoreUrl = this.escapeHtml(input.androidPlayStoreUrl);
    const adminWebUrl = this.escapeHtml(input.adminWebUrl);

    return `
<!doctype html>
<html lang="hu">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Fempy teszt email</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#162033;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #dde5ef;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 34px;background:#ffffff;border-bottom:1px solid #e8eef5;">
                ${
                  input.hasLogo
                    ? '<img src="cid:fempy-logo" width="190" alt="Fempy App" style="display:block;max-width:190px;height:auto;">'
                    : '<div style="font-size:24px;font-weight:700;color:#162033;">Fempy</div>'
                }
              </td>
            </tr>
            <tr>
              <td style="padding:34px 34px 10px;">
                <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7b8ba1;font-weight:700;">Email szolgáltatás teszt</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;color:#162033;font-weight:700;">Sikeres teszt email</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 34px 30px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Kedves ${name}!</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Ez egy Fempy teszt email. Ha ezt az üzenetet megkaptad, az email szolgáltatás működik.</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#607089;">Az alkalmazás közvetlenül letölthető az áruházakból:</p>
                ${this.buildStoreLinksHtml(iosAppStoreUrl, androidPlayStoreUrl)}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:8px;border:1px solid #b8c6d8;background:#ffffff;">
                      <a href="${adminWebUrl}" style="display:inline-block;padding:12px 18px;color:#26374d;text-decoration:none;font-size:15px;font-weight:700;">Webes felület</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${this.buildMailFooterHtml('A levelet a Fempy superadmin teszt-email funkciója küldte.')}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private buildTenantWelcomeEmailHtml(input: {
    adminName: string;
    email: string;
    password: string;
    iosAppStoreUrl: string;
    androidPlayStoreUrl: string;
    adminWebUrl: string;
    tenantName: string;
    hasLogo: boolean;
  }) {
    const adminName = this.escapeHtml(input.adminName);
    const email = this.escapeHtml(input.email);
    const password = this.escapeHtml(input.password);
    const iosAppStoreUrl = this.escapeHtml(input.iosAppStoreUrl);
    const androidPlayStoreUrl = this.escapeHtml(input.androidPlayStoreUrl);
    const adminWebUrl = this.escapeHtml(input.adminWebUrl);
    const tenantName = this.escapeHtml(input.tenantName);

    return `
<!doctype html>
<html lang="hu">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Fempy hozzáférés</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#162033;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #dde5ef;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 36px;background:#ffffff;border-bottom:1px solid #e8eef5;">
                ${
                  input.hasLogo
                    ? '<img src="cid:fempy-logo" width="210" alt="Fempy App" style="display:block;max-width:210px;height:auto;">'
                    : '<div style="font-size:24px;font-weight:700;color:#162033;">Fempy</div>'
                }
              </td>
            </tr>
            <tr>
              <td style="padding:34px 36px 12px;">
                <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7b8ba1;font-weight:700;">Ingyenes tesztidőszak</div>
                <h1 style="margin:10px 0 0;font-size:25px;line-height:1.28;color:#162033;font-weight:700;">Üdvözlünk a Fempy felületén</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#607089;">${tenantName} számára létrehoztuk az admin hozzáférést.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 0;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Kedves ${adminName}!</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Köszönjük megtisztelő érdeklődésed fejlesztésünk iránt. Az alkalmazást jelenleg ingyenes verzióban állítottuk be számodra. Az egy hónapos tesztidőszak alatt munkatársaiddal együtt lehetőségetek lesz kipróbálni többek között például a napi hangulat, napi kérdőív, egyéni fejlesztői és egyszerű riport funkciókat. A használat közbeni visszajelzéseknek örülünk, amelyek alapján a Fempy továbbfejlesztésén folyamatosan dolgozunk.</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#607089;background:#f8fbff;border:1px solid #d9e3ef;border-radius:10px;padding:14px 16px;"><strong style="color:#162033;">Fontos:</strong> Androidon az alkalmazás használata a regisztrációtól számított 24 órán belül tud elindulni a tesztidőszak aktiválása miatt.</p>
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#27364a;">A Fempy alkalmazást az alábbi áruházi linkeken keresztül töltheted le. A belépéshez kérlek, az alábbi felhasználónevet és jelszót használd.</p>
                ${this.buildStoreLinksHtml(iosAppStoreUrl, androidPlayStoreUrl)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 26px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9e3ef;border-radius:10px;background:#f8fbff;">
                  <tr>
                    <td style="padding:18px 20px;border-bottom:1px solid #d9e3ef;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7b8ba1;font-weight:700;">Felhasználónév</div>
                      <div style="margin-top:5px;font-size:16px;color:#162033;font-weight:700;">${email}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7b8ba1;font-weight:700;">Jelszó</div>
                      <div style="margin-top:5px;font-size:16px;color:#162033;font-weight:700;">${password}</div>
                      <div style="margin-top:8px;font-size:13px;line-height:1.5;color:#607089;">Kérlek, az első belépés után biztonsági okokból változtasd meg a jelszavad.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;border:1px solid #b8c6d8;background:#ffffff;">
                      <a href="${adminWebUrl}" style="display:inline-block;padding:12px 18px;color:#26374d;text-decoration:none;font-size:15px;font-weight:700;">Webes felület</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px 34px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Munkatársaid meghívását a webes felületen keresztül tudod megtenni, amit a következő linken keresztül érsz el:</p>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#27364a;">Link: <a href="${adminWebUrl}" style="color:#d4145a;text-decoration:none;font-weight:700;">${adminWebUrl}</a></p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">A csatolmányban megtalálod az admin felület és a mobilapp felhasználói kézikönyvét PDF formátumban.</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Jó felfedezést és sikeres közös fejlődést kívánunk!</p>
                <p style="margin:0;font-size:16px;line-height:1.7;color:#27364a;font-weight:700;">Fempy csapata</p>
              </td>
            </tr>
            ${this.buildMailFooterHtml('Ezt az üzenetet azért kaptad, mert létrehoztunk számodra egy Fempy admin hozzáférést.')}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private buildTenantWelcomeEmailText(input: {
    adminName: string;
    email: string;
    password: string;
    appDownloadUrl: string;
    iosAppStoreUrl: string;
    androidPlayStoreUrl: string;
    adminWebUrl: string;
  }) {
    return `Kedves ${input.adminName}!

Köszönjük megtisztelő érdeklődésed fejlesztésünk iránt. Az alkalmazást jelenleg ingyenes verzióban állítottuk be számodra. Az egy hónapos tesztidőszak alatt munkatársaiddal együtt lehetőségetek lesz kipróbálni többek között például a napi hangulat, napi kérdőív, egyéni fejlesztői és egyszerű riport funkciókat. A használat közbeni visszajelzéseknek örülünk, amelyek alapján a Fempy továbbfejlesztésén folyamatosan dolgozunk.

A letöltést az alábbi linkre kattintva, vagy Play Áruház / App Store-ból közvetlenül is megteheted. A belépéshez kérlek, az alábbi felhasználónevet és jelszót használd.

Fontos: Androidon az alkalmazás használata a regisztrációtól számított 24 órán belül tud elindulni a tesztidőszak aktiválása miatt.

Letöltés: ${input.appDownloadUrl}
iOS App Store: ${input.iosAppStoreUrl}
Android Play Áruház: ${input.androidPlayStoreUrl}
Felhasználónév: ${input.email}
Jelszó: ${input.password}
Kérlek, az első belépés után biztonsági okokból változtasd meg a jelszavad.

Munkatársaid meghívását a webes felületen keresztül tudod megtenni, amit a következő linken keresztül érsz el:
Link: ${input.adminWebUrl}

A csatolmányban megtalálod az admin felület és a mobilapp felhasználói kézikönyvét PDF formátumban.

Jó felfedezést és sikeres közös fejlődést kívánunk!
Fempy csapata${this.buildMailTextFooter()}`;
  }

  private buildStoreLinksHtml(
    iosAppStoreUrl: string,
    androidPlayStoreUrl: string,
  ) {
    return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                  <tr>
                    <td style="padding:0 10px 10px 0;vertical-align:top;">
                      <a href="${iosAppStoreUrl}" style="display:block;width:184px;max-width:100%;text-decoration:none;">
                        <img src="cid:fempy-appstore-badge" width="184" height="50" alt="Letöltés az App Store-ból" style="display:block;width:184px;max-width:100%;height:50px;border:0;">
                      </a>
                    </td>
                    <td style="padding:0 0 10px 0;vertical-align:top;">
                      <a href="${androidPlayStoreUrl}" style="display:block;width:169px;max-width:100%;text-decoration:none;">
                        <img src="cid:fempy-playstore-badge" width="169" height="50" alt="Elérhető itt: Google Play" style="display:block;width:169px;max-width:100%;height:50px;border:0;">
                      </a>
                    </td>
                  </tr>
                </table>`;
  }

  private buildMailFooterHtml(note: string) {
    return `
            <tr>
              <td style="padding:20px 34px;background:#eef3f8;border-top:1px solid #dce6f1;color:#7b8ba1;font-size:12px;line-height:1.5;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:0;vertical-align:middle;color:#7b8ba1;font-size:12px;line-height:1.5;">
                      <div style="margin:0 0 8px;">${note}</div>
                      <div style="margin:0;">
                        Kapcsolat:
                        <a href="mailto:${CONTACT_EMAIL}" style="color:#d4145a;text-decoration:none;font-weight:700;">${CONTACT_EMAIL}</a>
                      </div>
                    </td>
                    <td align="right" style="padding:0 0 0 18px;vertical-align:middle;white-space:nowrap;">
                      <a href="${LINKEDIN_URL}" style="display:inline-block;text-decoration:none;">
                        <img src="cid:fempy-linkedin-icon" width="24" height="24" alt="Fempy LinkedIn" style="display:block;width:24px;height:24px;border:0;">
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
  }

  private buildMailTextFooter() {
    return `

Kapcsolat: ${CONTACT_EMAIL}
LinkedIn: ${LINKEDIN_URL}`;
  }

  private resolveMailLogoPath() {
    const configuredPath = this.config.get<string>('MAIL_LOGO_PATH');
    return configuredPath && existsSync(configuredPath)
      ? configuredPath
      : this.resolveMailAssetPath('logo.png');
  }

  private resolveMailAssetPath(filename: string) {
    const candidates = [
      join(process.cwd(), 'dist', 'src', 'mail', 'assets', filename),
      join(process.cwd(), 'src', 'mail', 'assets', filename),
    ];

    return candidates.find((path) => existsSync(path)) ?? null;
  }

  private resolveMailAttachmentPath(filename: string) {
    const candidates = [
      join(process.cwd(), 'dist', 'src', 'mail', 'attachments', filename),
      join(process.cwd(), 'src', 'mail', 'attachments', filename),
    ];

    return candidates.find((path) => existsSync(path)) ?? null;
  }

  private buildManualAttachments(
    manuals: Array<{ filename: string; fallbackName: string }>,
  ): Mail.Attachment[] {
    const attachments: Mail.Attachment[] = [];

    for (const { filename, fallbackName } of manuals) {
      const path = this.resolveMailAttachmentPath(filename);

      if (path) {
        attachments.push({
          filename: fallbackName,
          path,
          contentType: 'application/pdf',
        });
      }
    }

    return attachments;
  }

  private buildMailAssetAttachments(
    logoPath: string | null,
  ): Mail.Attachment[] {
    const attachments: Mail.Attachment[] = [];

    if (logoPath) {
      attachments.push({
        filename: 'fempy-logo.png',
        path: logoPath,
        cid: 'fempy-logo',
      });
    }

    const appStorePath = this.resolveMailAssetPath('appstore.svg');
    const playStorePath = this.resolveMailAssetPath('playstore.svg');
    const linkedInPath = this.resolveMailAssetPath('linkedin.png');

    if (appStorePath) {
      attachments.push({
        filename: 'appstore.svg',
        path: appStorePath,
        cid: 'fempy-appstore-badge',
        contentType: 'image/svg+xml',
      });
    }

    if (playStorePath) {
      attachments.push({
        filename: 'playstore.svg',
        path: playStorePath,
        cid: 'fempy-playstore-badge',
        contentType: 'image/svg+xml',
      });
    }

    if (linkedInPath) {
      attachments.push({
        filename: 'linkedin.png',
        path: linkedInPath,
        cid: 'fempy-linkedin-icon',
        contentType: 'image/png',
      });
    }

    return attachments;
  }

  private escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
