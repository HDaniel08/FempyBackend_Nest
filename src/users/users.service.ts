import { Injectable, NotFoundException,ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateMyProfileDto } from "./dto/update-my-profile.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import * as crypto from "crypto";
/**
 * UsersService
 * - userCtx: a JWT-ből jön (sub, tenantId, email, isLeader...)
 */
function getUserIdFromCtx(userCtx: any) {
  return userCtx?.sub ?? userCtx?.id ?? userCtx?.userId;
}
function isValidPresetId(v: any) {
  const s = String(v ?? "").trim();
  return ["1", "2", "3", "4", "5", "6", "7"].includes(s);
}
function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function sign(data: string, secret: string) {
  return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}
@Injectable()
export class UsersService {
  
  constructor(private readonly prisma: PrismaService) {}

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
    where: { email, isDeleted: false },
    include: { tenant: true },
  });
}

  /**
   * User létrehozása tenanton belül.
   * A passwordHash már hash-elt legyen!
   */
  createUser(input: {
    tenantId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    isLeader?: boolean;
    positionId?: string | null;
  }) {
    return this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        isLeader: input.isLeader ?? false,
        positionId: input.positionId ?? null,
        // profile opcionális: később create-elhetjük együtt
      },
    });
  }

  /**
   * "Me" adat lekérdezéséhez:
   * - user + profile + position
   */
  getUserWithDetails(tenantId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { tenantId, id: userId, isDeleted: false },
      include: {
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
        profile: true,
        position: true,
      },
    });

    if (!user) throw new NotFoundException("User not found");

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
      throw new NotFoundException("User not found");
    }

    // Preset kiválasztás kezelése
    // - ha dto.profilePic jön és valid 1..7: állítjuk
    // - ha presetet választ, a feltöltött URL-t töröljük (különben az nyerne a UI-ban)
    const incomingPreset = (dto as any).profilePic;
    const shouldSetPreset = incomingPreset !== undefined && incomingPreset !== null;

    const nextProfilePic = shouldSetPreset
      ? (isValidPresetId(incomingPreset) ? String(incomingPreset) : null)
      : (user.profile?.profilePic ?? "1");

    if (shouldSetPreset && nextProfilePic === null) {
      throw new BadRequestException("Invalid profilePic (must be 1..7)");
    }

    // profilePicUrl:
    // - ha a dto direkt küldi: elfogadjuk (pl. nullázás, vagy később bármi)
    // - különben marad a meglévő
    const hasProfilePicUrlField = Object.prototype.hasOwnProperty.call(dto as any, "profilePicUrl");
    const nextProfilePicUrl =
      hasProfilePicUrlField
        ? (dto as any).profilePicUrl ?? null
        : (user.profile as any)?.profilePicUrl ?? null;

    const profileData: any = {
      nickname: dto.nickname ?? null,
      birthday: dto.birthday ? new Date(dto.birthday) : null,
      gender: dto.gender ?? null,
      dateOfStart: dto.dateOfStart ? new Date(dto.dateOfStart) : null,
      description: dto.description ?? null,

      isAnonymous: dto.isAnonymous ?? user.profile?.isAnonymous ?? false,
      isPublic: dto.isPublic ?? user.profile?.isPublic ?? true,
      onHoliday: dto.onHoliday ?? user.profile?.onHoliday ?? false,

      lessNotification: dto.lessNotification ?? user.profile?.lessNotification ?? false,
      emailNotification: dto.emailNotification ?? user.profile?.emailNotification ?? false,
      dailyNotification: dto.dailyNotification ?? user.profile?.dailyNotification ?? true,

      profilePic: nextProfilePic,
      profilePicUrl: nextProfilePicUrl,
    };

    // Ha presetet választott, a feltöltöttet töröljük (UX: preset felülír)
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

  if (!tenantId) throw new BadRequestException("Missing tenantId in request context");
  if (!userId) throw new BadRequestException("Missing userId in request context");

  return this.prisma.userGoal.findMany({
    where: { tenantId, userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

async createMyGoal(userCtx: any, dto: CreateGoalDto) {
  const userId = getUserIdFromCtx(userCtx);
  const tenantId = userCtx?.tenantId;

  if (!tenantId) throw new BadRequestException("Missing tenantId in request context");
  if (!userId) throw new BadRequestException("Missing userId in request context");

  const text = dto.text.trim();

  const last = await this.prisma.userGoal.findFirst({
    where: { tenantId, userId },
    orderBy: { order: "desc" },
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

  if (!tenantId) throw new BadRequestException("Missing tenantId in request context");
  if (!userId) throw new BadRequestException("Missing userId in request context");

  const goal = await this.prisma.userGoal.findFirst({
    where: { id: goalId, tenantId, userId },
  });

  if (!goal) throw new NotFoundException("Goal not found");

  await this.prisma.userGoal.delete({ where: { id: goalId } });
  return { ok: true };
}

 
}