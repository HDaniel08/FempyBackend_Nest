import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync } from 'fs';
import { join } from 'path';
import { MailService } from '../mail/mail.service';
import { randomInt } from 'crypto';
/**
 * UsersService
 * - userCtx: a JWT-bÅ‘l jÃ¶n (sub, tenantId, email, isLeader...)
 */
function getUserIdFromCtx(userCtx: any) {
  return userCtx?.sub ?? userCtx?.id ?? userCtx?.userId;
}
function isValidPresetId(v: any) {
  const s = String(v ?? '').trim();
  return ['1', '2', '3', '4', '5', '6', '7'].includes(s);
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  findByEmail(tenantId: string, email: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        email,
        isDeleted: false,
      },
    });
  }
  findByEmailGlobal(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        isDeleted: false,
      },
      include: { tenant: true },
    });
  }

  async resetForgottenPassword(user: {
    id: string;
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    mustChangePassword: boolean;
    tenant: { name: string };
  }) {
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    try {
      await this.sendPasswordResetEmail({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: temporaryPassword,
        tenantName: user.tenant.name,
      });
      return true;
    } catch (error) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: user.passwordHash,
          mustChangePassword: user.mustChangePassword,
        },
      });
      this.logger.error(
        'Password reset email sending failed',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * User lÃ©trehozÃ¡sa tenanton belÃ¼l.
   * A passwordHash mÃ¡r hash-elt legyen!
   */
  createUser(input: {
    tenantId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    isLeader?: boolean;
    positionId?: string | null;
    mustChangePassword?: boolean;
  }) {
    return this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role ?? UserRole.USER,
        isLeader: input.isLeader ?? false,
        positionId: input.positionId ?? null,
        mustChangePassword: input.mustChangePassword ?? false,
        // profile opcionÃ¡lis: kÃ©sÅ‘bb create-elhetjÃ¼k egyÃ¼tt
      },
    });
  }

  /**
   * "Me" adat lekÃ©rdezÃ©sÃ©hez:
   * - user + profile + position
   */
  getUserWithDetails(tenantId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { tenantId, id: userId, isDeleted: false },
      include: {
        tenant: true,
        profile: true,
        position: true,
      },
    });
  }

  async getMe(userCtx: { sub: string; tenantId: string }) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userCtx.sub,
        tenantId: userCtx.tenantId,
        isDeleted: false,
      },
      include: {
        tenant: true,
        profile: true,
        position: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async updateMyProfile(
    userCtx: { sub: string; tenantId: string },
    dto: UpdateMyProfileDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userCtx.sub,
        tenantId: userCtx.tenantId,
        isDeleted: false,
      },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Preset kivÃ¡lasztÃ¡s kezelÃ©se
    // - ha dto.profilePic jÃ¶n Ã©s valid 1..7: Ã¡llÃ­tjuk
    // - ha presetet vÃ¡laszt, a feltÃ¶ltÃ¶tt URL-t tÃ¶rÃ¶ljÃ¼k (kÃ¼lÃ¶nben az nyerne a UI-ban)
    const incomingPreset = (dto as any).profilePic;
    const shouldSetPreset =
      incomingPreset !== undefined && incomingPreset !== null;

    const nextProfilePic = shouldSetPreset
      ? isValidPresetId(incomingPreset)
        ? String(incomingPreset)
        : null
      : (user.profile?.profilePic ?? '1');

    if (shouldSetPreset && nextProfilePic === null) {
      throw new BadRequestException('Invalid profilePic (must be 1..7)');
    }

    // profilePicUrl:
    // - ha a dto direkt kÃ¼ldi: elfogadjuk (pl. nullÃ¡zÃ¡s, vagy kÃ©sÅ‘bb bÃ¡rmi)
    // - kÃ¼lÃ¶nben marad a meglÃ©vÅ‘
    const hasProfilePicUrlField = Object.prototype.hasOwnProperty.call(
      dto as any,
      'profilePicUrl',
    );
    const nextProfilePicUrl = hasProfilePicUrlField
      ? ((dto as any).profilePicUrl ?? null)
      : ((user.profile as any)?.profilePicUrl ?? null);

    const profileData: any = {
      nickname: dto.nickname ?? null,
      birthday: dto.birthday ? new Date(dto.birthday) : null,
      gender: dto.gender ?? null,
      dateOfStart: dto.dateOfStart ? new Date(dto.dateOfStart) : null,
      description: dto.description ?? null,

      isAnonymous: dto.isAnonymous ?? user.profile?.isAnonymous ?? false,
      isPublic: dto.isPublic ?? user.profile?.isPublic ?? true,
      onHoliday: dto.onHoliday ?? user.profile?.onHoliday ?? false,

      lessNotification:
        dto.lessNotification ?? user.profile?.lessNotification ?? false,
      emailNotification:
        dto.emailNotification ?? user.profile?.emailNotification ?? false,
      dailyNotification:
        dto.dailyNotification ?? user.profile?.dailyNotification ?? true,

      profilePic: nextProfilePic,
      profilePicUrl: nextProfilePicUrl,
    };

    // Ha presetet vÃ¡lasztott, a feltÃ¶ltÃ¶ttet tÃ¶rÃ¶ljÃ¼k (UX: preset felÃ¼lÃ­r)
    if (shouldSetPreset) {
      profileData.profilePicUrl = null;
    }

    await this.prisma.userProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: {
        ...profileData,
        userId: user.id,
        tenantId: user.tenantId,
      },
    });

    return this.prisma.user.findFirst({
      where: { id: user.id, tenantId: user.tenantId },
      include: { profile: true, position: true },
    });
  }

  async getMyGoals(userCtx: any) {
    const userId = getUserIdFromCtx(userCtx);
    const tenantId = userCtx?.tenantId;

    if (!tenantId)
      throw new BadRequestException('Missing tenantId in request context');
    if (!userId)
      throw new BadRequestException('Missing userId in request context');

    return this.prisma.userGoal.findMany({
      where: { tenantId, userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createMyGoal(userCtx: any, dto: CreateGoalDto) {
    const userId = getUserIdFromCtx(userCtx);
    const tenantId = userCtx?.tenantId;

    if (!tenantId)
      throw new BadRequestException('Missing tenantId in request context');
    if (!userId)
      throw new BadRequestException('Missing userId in request context');

    const text = dto.text.trim();

    const last = await this.prisma.userGoal.findFirst({
      where: { tenantId, userId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const nextOrder = (last?.order ?? -1) + 1;

    return this.prisma.userGoal.create({
      data: { tenantId, userId, text, order: nextOrder },
    });
  }

  async deleteMyGoal(userCtx: any, goalId: string) {
    const userId = getUserIdFromCtx(userCtx);
    const tenantId = userCtx?.tenantId;

    if (!tenantId)
      throw new BadRequestException('Missing tenantId in request context');
    if (!userId)
      throw new BadRequestException('Missing userId in request context');

    const goal = await this.prisma.userGoal.findFirst({
      where: { id: goalId, tenantId, userId },
    });

    if (!goal) throw new NotFoundException('Goal not found');

    await this.prisma.userGoal.delete({ where: { id: goalId } });
    return { ok: true };
  }

  async adminListUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
      },
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
        position: {
          select: {
            id: true,
            name: true,
          },
        },
        profile: {
          select: {
            nickname: true,
            profilePic: true,
            profilePicUrl: true,
          },
        },
      },
      orderBy: [
        { isDeleted: 'asc' },
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });
  }

  async adminGetUserSupport(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
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
        position: { select: { id: true, name: true } },
        profile: {
          select: {
            nickname: true,
            isAnonymous: true,
            isPublic: true,
            onHoliday: true,
            dailyNotification: true,
            lessNotification: true,
            profilePic: true,
            profilePicUrl: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [
      devices,
      recentMoods,
      pendingAnswers,
      recentAnswers,
      activity,
      usage,
    ] = await Promise.all([
      this.prisma.userDevice.findMany({
        where: { tenantId, userId },
        orderBy: { lastSeenAt: 'desc' },
        take: 5,
      }),
      this.prisma.dailyMood.findMany({
        where: { tenantId, userId },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      this.prisma.dailyQuestionnaireAnswer.count({
        where: { tenantId, userId, isActive: true, filledAt: null },
      }),
      this.prisma.dailyQuestionnaireAnswer.findMany({
        where: { tenantId, userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          question: { select: { question: true, topic: true } },
        },
      }),
      this.prisma.activityEvent.findMany({
        where: { tenantId, userId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      this.prisma.appUsageSession.aggregate({
        where: { tenantId, userId },
        _sum: { durationSeconds: true },
        _max: { lastSeenAt: true },
        _count: { id: true },
      }),
    ]);

    return {
      user,
      devices,
      recentMoods,
      dailyQuestions: {
        pendingAnswers,
        recentAnswers,
      },
      activity,
      usage: {
        totalSeconds: usage._sum.durationSeconds ?? 0,
        sessions: usage._count.id,
        lastSeenAt: usage._max.lastSeenAt,
      },
    };
  }

  async adminCreateUser(
    tenantId: string,
    input: {
      email: string;
      temporaryPassword: string;
      firstName: string;
      lastName: string;
      role?: UserRole;
    },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: {
        email: input.email,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Ezzel az email címmel már létezik felhasználó.',
      );
    }

    const passwordHash = await bcrypt.hash(input.temporaryPassword, 10);

    const [tenant, created] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.user.create({
        data: {
          tenantId,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role ?? UserRole.USER,
          isLeader: input.role === UserRole.LEADER,
          isDeleted: false,
          mustChangePassword: true,

          profile: {
            create: {
              tenantId,
              nickname: null,
              isAnonymous: false,
              isPublic: true,
              onHoliday: false,
              lessNotification: false,
              emailNotification: false,
              dailyNotification: true,
              profilePic: '1',
              profilePicUrl: null,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isLeader: true,
          isDeleted: true,
          mustChangePassword: true,
          createdAt: true,
          profile: true,
        },
      }),
    ]);

    await this.sendCoworkerWelcomeEmail({
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
      password: input.temporaryPassword,
      tenantName: tenant?.name ?? 'Fempy',
    });

    return created;
  }

  async adminUpdateUser(
    tenantId: string,
    userId: string,
    input: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: UserRole;
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (input.role && user.role === 'ADMIN' && input.role !== 'ADMIN') {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          tenantId,
          role: 'ADMIN',
          isDeleted: false,
        },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          'Az utolsó aktív adminisztrátor szerepköre nem módosítható.',
        );
      }
    }

    if (input.email && input.email !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          email: input.email,
          id: {
            not: userId,
          },
        },
      });

      if (existing) {
        throw new BadRequestException(
          'Ezzel az email címmel már létezik felhasználó.',
        );
      }
    }

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        isLeader: input.role ? input.role === UserRole.LEADER : undefined,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isLeader: true,
        isDeleted: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });
  }

  async changeMyPassword(
    userCtx: { sub: string; tenantId: string },
    input: {
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userCtx.sub,
        tenantId: userCtx.tenantId,
        isDeleted: false,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const newPassword = input.newPassword ?? '';
    if (newPassword.length < 8) {
      throw new BadRequestException('Az új jelszó legalább 8 karakter legyen.');
    }

    if (!user.mustChangePassword) {
      const ok = await bcrypt.compare(
        input.currentPassword ?? '',
        user.passwordHash,
      );
      if (!ok) {
        throw new BadRequestException('A jelenlegi jelszó nem megfelelő.');
      }
    }

    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw new BadRequestException(
        'Az új jelszó nem egyezhet meg a jelenlegivel.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      include: {
        tenant: true,
        profile: true,
        position: true,
      },
    });
  }

  async adminSetUserPassword(
    tenantId: string,
    userId: string,
    input: {
      newPassword?: string;
      mustChangePassword?: boolean;
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const newPassword = input.newPassword ?? '';
    if (newPassword.length < 8) {
      throw new BadRequestException('Az új jelszó legalább 8 karakter legyen.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: input.mustChangePassword ?? true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isLeader: true,
        isDeleted: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });
  }

  async adminSetUserDeleted(
    tenantId: string,
    userId: string,
    isDeleted: boolean,
    currentUserId?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (isDeleted && currentUserId && userId === currentUserId) {
      throw new BadRequestException('Saját magadat nem deaktiválhatod.');
    }

    if (isDeleted && user.role === 'ADMIN') {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          tenantId,
          role: 'ADMIN',
          isDeleted: false,
        },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          'Az utolsó aktív adminisztrátort nem lehet deaktiválni.',
        );
      }
    }

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        isDeleted,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isLeader: true,
        isDeleted: true,
        updatedAt: true,
      },
    });
  }

  async adminAssignUserPosition(
    tenantId: string,
    userId: string,
    positionId: string | null,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (positionId) {
      const position = await this.prisma.position.findFirst({
        where: {
          id: positionId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!position) {
        throw new NotFoundException('Position not found');
      }
    }

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        positionId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        position: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  private async sendCoworkerWelcomeEmail(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    tenantName: string;
  }) {
    try {
      const fullName = `${input.lastName} ${input.firstName}`.trim();
      const appDownloadUrl =
        this.config.get<string>('APP_DOWNLOAD_URL') ?? 'https://fempyapp.com';
      const adminWebUrl =
        this.config.get<string>('ADMIN_WEB_URL') ??
        this.config.get<string>('PUBLIC_BASE_URL') ??
        'https://fempyadmin.pages.dev/';
      const logoPath = this.resolveMailLogoPath();

      await this.mail.sendMail({
        to: { email: input.email, name: fullName },
        subject: 'Fempy - Hozzáférésed elkészült',
        html: this.buildCoworkerWelcomeEmailHtml({
          fullName,
          email: input.email,
          password: input.password,
          appDownloadUrl,
          adminWebUrl,
          tenantName: input.tenantName,
          hasLogo: !!logoPath,
        }),
        text: this.buildCoworkerWelcomeEmailText({
          fullName,
          email: input.email,
          password: input.password,
          appDownloadUrl,
          adminWebUrl,
          tenantName: input.tenantName,
        }),
        attachments: logoPath
          ? [
              {
                filename: 'fempy-logo.png',
                path: logoPath,
                cid: 'fempy-logo',
              },
            ]
          : undefined,
      });
    } catch (error) {
      this.logger.error(
        'Coworker welcome email sending failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private generateTemporaryPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const all = `${upper}${lower}${digits}`;
    const characters = [
      upper[randomInt(upper.length)],
      lower[randomInt(lower.length)],
      digits[randomInt(digits.length)],
    ];

    while (characters.length < 8) {
      characters.push(all[randomInt(all.length)]);
    }

    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [characters[index], characters[swapIndex]] = [
        characters[swapIndex],
        characters[index],
      ];
    }

    return characters.join('');
  }

  private async sendPasswordResetEmail(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    tenantName: string;
  }) {
    const fullName = `${input.lastName} ${input.firstName}`.trim();
    const logoPath = this.resolveMailLogoPath();
    const safeName = this.escapeHtml(fullName);
    const safeEmail = this.escapeHtml(input.email);
    const safePassword = this.escapeHtml(input.password);
    const safeTenantName = this.escapeHtml(input.tenantName);

    await this.mail.sendMail({
      to: { email: input.email, name: fullName },
      subject: 'Fempy - Új ideiglenes jelszó',
      html: `
<!doctype html>
<html lang="hu">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Fempy ideiglenes jelszó</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#162033;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dde5ef;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:26px 34px;border-bottom:1px solid #e8eef5;">
                ${
                  logoPath
                    ? '<img src="cid:fempy-logo" width="190" alt="Fempy App" style="display:block;max-width:190px;height:auto;">'
                    : '<div style="font-size:24px;font-weight:700;color:#162033;">Fempy</div>'
                }
              </td>
            </tr>
            <tr>
              <td style="padding:32px 34px;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;color:#162033;">Új ideiglenes jelszó</h1>
                <p style="margin:18px 0 0;font-size:16px;line-height:1.7;color:#27364a;">Kedves ${safeName}!</p>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.7;color:#27364a;">A(z) ${safeTenantName} szervezethez tartozó Fempy fiókodhoz új ideiglenes jelszót kértél.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border:1px solid #d9e3ef;border-radius:10px;background:#f8fbff;">
                  <tr>
                    <td style="padding:17px 20px;border-bottom:1px solid #d9e3ef;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7b8ba1;font-weight:700;">Email</div>
                      <div style="margin-top:5px;font-size:16px;color:#162033;font-weight:700;">${safeEmail}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:17px 20px;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7b8ba1;font-weight:700;">Ideiglenes jelszó</div>
                      <div style="margin-top:5px;font-size:18px;color:#162033;font-weight:700;letter-spacing:.08em;">${safePassword}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#607089;">Bejelentkezés után kötelezően meg kell adnod egy új, saját jelszót.</p>
                <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#7b8ba1;">Ha nem te kérted az új jelszót, jelezd a szervezeted adminisztrátorának.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      text: `Kedves ${fullName}!

A(z) ${input.tenantName} szervezethez tartozó Fempy fiókodhoz új ideiglenes jelszót kértél.

Email: ${input.email}
Ideiglenes jelszó: ${input.password}

Bejelentkezés után kötelezően meg kell adnod egy új, saját jelszót.

Ha nem te kérted az új jelszót, jelezd a szervezeted adminisztrátorának.`,
      attachments: logoPath
        ? [
            {
              filename: 'fempy-logo.png',
              path: logoPath,
              cid: 'fempy-logo',
            },
          ]
        : undefined,
    });
  }

  private buildCoworkerWelcomeEmailHtml(input: {
    fullName: string;
    email: string;
    password: string;
    appDownloadUrl: string;
    adminWebUrl: string;
    tenantName: string;
    hasLogo: boolean;
  }) {
    const fullName = this.escapeHtml(input.fullName);
    const email = this.escapeHtml(input.email);
    const password = this.escapeHtml(input.password);
    const appDownloadUrl = this.escapeHtml(input.appDownloadUrl);
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
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dde5ef;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:26px 34px;background:#ffffff;border-bottom:1px solid #e8eef5;">
                ${
                  input.hasLogo
                    ? '<img src="cid:fempy-logo" width="190" alt="Fempy App" style="display:block;max-width:190px;height:auto;">'
                    : '<div style="font-size:24px;font-weight:700;color:#162033;">Fempy</div>'
                }
              </td>
            </tr>
            <tr>
              <td style="padding:32px 34px 10px;">
                <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7b8ba1;font-weight:700;">Meghívás</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;color:#162033;font-weight:700;">Hozzáférést kaptál a Fempy alkalmazáshoz</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#607089;">${tenantName} csapatához kapcsolódva létrejött a fiókod.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 34px 0;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Kedves ${fullName}!</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Meghívást kaptál a Fempy alkalmazásba, ahol egyszerűen tudod használni a napi hangulat, napi kérdőív és egyéni fejlesztői funkciókat.</p>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#27364a;">Az alkalmazást az alábbi linken keresztül töltheted le. A belépéshez használd az alábbi adatokat.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 34px 26px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9e3ef;border-radius:10px;background:#f8fbff;">
                  <tr>
                    <td style="padding:17px 20px;border-bottom:1px solid #d9e3ef;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7b8ba1;font-weight:700;">Felhasználónév</div>
                      <div style="margin-top:5px;font-size:16px;color:#162033;font-weight:700;">${email}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:17px 20px;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7b8ba1;font-weight:700;">Jelszó</div>
                      <div style="margin-top:5px;font-size:16px;color:#162033;font-weight:700;">${password}</div>
                      <div style="margin-top:8px;font-size:13px;line-height:1.5;color:#607089;">Kérlek, az első belépés után biztonsági okokból változtasd meg a jelszavad.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 34px 10px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:#d4145a;">
                      <a href="${appDownloadUrl}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Alkalmazás letöltése</a>
                    </td>
                    <td width="12"></td>
                    <td style="border-radius:8px;border:1px solid #b8c6d8;background:#ffffff;">
                      <a href="${adminWebUrl}" style="display:inline-block;padding:12px 18px;color:#26374d;text-decoration:none;font-size:15px;font-weight:700;">Webes felület</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 34px 34px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#27364a;">Jó felfedezést és sikeres közös fejlődést kívánunk!</p>
                <p style="margin:0;font-size:16px;line-height:1.7;color:#27364a;font-weight:700;">Fempy csapata</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 34px;background:#eef3f8;color:#7b8ba1;font-size:12px;line-height:1.5;">
                Ezt az üzenetet azért kaptad, mert meghívást kaptál a Fempy alkalmazásba.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private buildCoworkerWelcomeEmailText(input: {
    fullName: string;
    email: string;
    password: string;
    appDownloadUrl: string;
    adminWebUrl: string;
    tenantName: string;
  }) {
    return `Kedves ${input.fullName}!

Meghívást kaptál a Fempy alkalmazásba a(z) ${input.tenantName} csapatához kapcsolódva, ahol egyszerűen tudod használni a napi hangulat, napi kérdőív és egyéni fejlesztői funkciókat.

Letöltés: ${input.appDownloadUrl}
Felhasználónév: ${input.email}
Jelszó: ${input.password}
Kérlek, az első belépés után biztonsági okokból változtasd meg a jelszavad.

Webes felület: ${input.adminWebUrl}

Jó felfedezést és sikeres közös fejlődést kívánunk!
Fempy csapata`;
  }

  private resolveMailLogoPath() {
    const configuredPath = this.config.get<string>('MAIL_LOGO_PATH');
    const candidates = [
      configuredPath,
      join(process.cwd(), 'dist', 'src', 'mail', 'assets', 'logo.png'),
      join(process.cwd(), 'src', 'mail', 'assets', 'logo.png'),
    ].filter(Boolean) as string[];

    return candidates.find((path) => existsSync(path)) ?? null;
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
