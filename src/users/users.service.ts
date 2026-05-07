import { Injectable, NotFoundException,ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateMyProfileDto } from "./dto/update-my-profile.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
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
    role?: UserRole;
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
        role: input.role ?? UserRole.USER,
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
      { isDeleted: "asc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });
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
    throw new BadRequestException("Ezzel az email címmel már létezik felhasználó.");
  }

  const passwordHash = await bcrypt.hash(input.temporaryPassword, 10);

  return this.prisma.user.create({
    data: {
      tenantId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role ?? UserRole.USER,
      isLeader: input.role === UserRole.LEADER,
      isDeleted: false,

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
          profilePic: "1",
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
      createdAt: true,
      profile: true,
    },
  });
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
    throw new NotFoundException("User not found");
  }
  if (
  input.role &&
  user.role === "ADMIN" &&
  input.role !== "ADMIN"
) {
  const activeAdminCount = await this.prisma.user.count({
    where: {
      tenantId,
      role: "ADMIN",
      isDeleted: false,
    },
  });

  if (activeAdminCount <= 1) {
    throw new BadRequestException(
      "Az utolsó aktív adminisztrátor szerepköre nem módosítható.",
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
      throw new BadRequestException("Ezzel az email címmel már létezik felhasználó.");
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
    throw new NotFoundException("User not found");
  }

  if (isDeleted && currentUserId && userId === currentUserId) {
    throw new BadRequestException("Saját magadat nem deaktiválhatod.");
  }

  if (isDeleted && user.role === "ADMIN") {
    const activeAdminCount = await this.prisma.user.count({
      where: {
        tenantId,
        role: "ADMIN",
        isDeleted: false,
      },
    });

    if (activeAdminCount <= 1) {
      throw new BadRequestException(
        "Az utolsó aktív adminisztrátort nem lehet deaktiválni.",
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
    throw new NotFoundException("User not found");
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
      throw new NotFoundException("Position not found");
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

 
}
