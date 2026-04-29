import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async register(
    tenantId: string,
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    },
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

    return this.signToken({
      tenantId,
      userId: user.id,
      email: user.email,
      isLeader: user.isLeader,
      role: user.role,
    });
  }

  async login(tenantId: string, input: { email: string; password: string }) {
    const user = await this.users.findByEmail(tenantId, input.email);

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);

    if (!ok) {
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    return this.signToken({
      tenantId,
      userId: user.id,
      email: user.email,
      isLeader: user.isLeader,
      role: user.role,
    });
  }

  async loginGlobal(input: { email: string; password: string }) {
    const user = await this.users.findByEmailGlobal(input.email);

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);

    if (!ok) {
      throw new UnauthorizedException('Hibás email vagy jelszó.');
    }

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
      },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
      },
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