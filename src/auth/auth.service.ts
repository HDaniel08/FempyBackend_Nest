import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ActivityLogService } from '../activity/activity-log.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly passwordResetCooldowns = new Map<string, number>();
  private readonly passwordResetCooldownMs = 15 * 60 * 1000;

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private activity: ActivityLogService,
  ) {}

  async register(
    tenantId: string,
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    },
    req?: any,
  ) {
    const existing = await this.users.findByEmail(tenantId, input.email);

    if (existing) {
      throw new BadRequestException(
        'Ezzel az emaillel már létezik felhasználó ebben a szervezetben.',
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.users.createUser({
      tenantId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    await this.activity.log({
      tenantId,
      userId: user.id,
      event: 'AUTH_REGISTERED',
      source: 'auth',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email: user.email },
      request: this.activity.requestMeta(req),
    });

    return this.signToken({
      tenantId,
      userId: user.id,
      email: user.email,
      isLeader: user.isLeader,
      role: user.role,
    });
  }

  async login(
    tenantId: string,
    input: { email: string; password: string },
    req?: any,
  ) {
    const user = await this.users.findByEmail(tenantId, input.email);

    if (!user || user.isDeleted) {
      await this.activity.log({
        tenantId,
        userId: user?.id ?? null,
        event: 'AUTH_LOGIN_FAILED',
        source: 'auth',
        entityType: user ? 'USER' : null,
        entityId: user?.id ?? null,
        metadata: {
          email: input.email,
          reason: !user ? 'not_found' : 'deleted',
        },
        request: this.activity.requestMeta(req),
      });
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);

    if (!ok) {
      await this.activity.log({
        tenantId,
        userId: user.id,
        event: 'AUTH_LOGIN_FAILED',
        source: 'auth',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: input.email, reason: 'bad_password' },
        request: this.activity.requestMeta(req),
      });
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    await this.activity.log({
      tenantId,
      userId: user.id,
      event: 'AUTH_LOGIN_SUCCEEDED',
      source: 'auth',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
      request: this.activity.requestMeta(req),
    });

    return this.signToken({
      tenantId,
      userId: user.id,
      email: user.email,
      isLeader: user.isLeader,
      role: user.role,
    });
  }

  async loginGlobal(input: { email: string; password: string }, req?: any) {
    const user = await this.users.findByEmailGlobal(input.email);

    if (!user || user.isDeleted) {
      if (user?.tenantId) {
        await this.activity.log({
          tenantId: user.tenantId,
          userId: user.id,
          event: 'AUTH_LOGIN_FAILED',
          source: 'auth',
          entityType: 'USER',
          entityId: user.id,
          metadata: { email: input.email, reason: 'deleted', global: true },
          request: this.activity.requestMeta(req),
        });
      }
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);

    if (!ok) {
      await this.activity.log({
        tenantId: user.tenantId,
        userId: user.id,
        event: 'AUTH_LOGIN_FAILED',
        source: 'auth',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: input.email, reason: 'bad_password', global: true },
        request: this.activity.requestMeta(req),
      });
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    await this.activity.log({
      tenantId: user.tenantId,
      userId: user.id,
      event: 'AUTH_LOGIN_SUCCEEDED',
      source: 'auth',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email: user.email, role: user.role, global: true },
      request: this.activity.requestMeta(req),
    });

    const token = await this.signToken({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      isLeader: user.isLeader,
      role: user.role,
    });

    return {
      accessToken: token.accessToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isLeader: user.isLeader,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        appAccessEnabled: user.tenant.appAccessEnabled,
      },
    };
  }

  async forgotPassword(email: string, req?: any) {
    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();
    const cooldownUntil = this.passwordResetCooldowns.get(normalizedEmail) ?? 0;

    if (cooldownUntil <= now) {
      const user = await this.users.findByEmailGlobal(normalizedEmail);

      if (user && !user.isDeleted) {
        this.passwordResetCooldowns.set(
          normalizedEmail,
          now + this.passwordResetCooldownMs,
        );

        const sent = await this.users.resetForgottenPassword(user);
        if (!sent) {
          this.passwordResetCooldowns.delete(normalizedEmail);
        } else {
          await this.activity.log({
            tenantId: user.tenantId,
            userId: user.id,
            event: 'AUTH_PASSWORD_RESET_REQUESTED',
            source: 'auth',
            entityType: 'USER',
            entityId: user.id,
            metadata: { email: normalizedEmail },
            request: this.activity.requestMeta(req),
          });
        }
      }
    }

    return {
      message:
        'Ha az email címhez tartozik aktív fiók, elküldtük az ideiglenes jelszót.',
    };
  }

  private async signToken(input: {
    tenantId: string;
    userId: string;
    email: string;
    isLeader: boolean;
    role: UserRole;
  }) {
    const payload = {
      sub: input.userId,
      tenantId: input.tenantId,
      email: input.email,
      isLeader: input.isLeader,
      role: input.role,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return { accessToken };
  }
}
