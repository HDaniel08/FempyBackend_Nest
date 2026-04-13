import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

/**
 * AuthService:
 * - Regisztráció: user létrehozása (bcrypt hash)
 * - Login: email+password ellenőrzés -> JWT token
 */
@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  /**
   * Regisztráció tenanton belül.
   * - TenantId a middlewareből jön (x-tenant-slug alapján).
   */
  async register(tenantId: string, input: { email: string; password: string; firstName: string; lastName: string }) {
    // 1) Ellenőrizzük, van-e már ilyen email a tenanton belül
    const existing = await this.users.findByEmail(tenantId, input.email);
    if (existing) {
      throw new BadRequestException('Ezzel az emaillel már létezik felhasználó ebben a szervezetben.');
    }

    // 2) Hash-eljük a jelszót (NE tárold plain textként)
    const passwordHash = await bcrypt.hash(input.password, 10);

    // 3) User létrehozása
    const user = await this.users.createUser({
      tenantId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    // 4) Token generálás rögtön (kényelmes UX)
    return this.signToken(tenantId, user.id, user.email, user.isLeader);
  }

  /**
   * Bejelentkezés tenanton belül.
   * - Tenant azonosítás headerből.
   */
  async login(tenantId: string, input: { email: string; password: string }) {
    const user = await this.users.findByEmail(tenantId, input.email);
    if (!user) throw new UnauthorizedException('Hibás email vagy jelszó.');

    // password ellenőrzés bcrypt-tel
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Hibás email vagy jelszó.');

    return this.signToken(tenantId, user.id, user.email, user.isLeader);
  }
  async loginGlobal(input: { email: string; password: string }) {
  const user = await this.users.findByEmailGlobal(input.email);
  if (!user) throw new UnauthorizedException('Hibás email vagy jelszó.');

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new UnauthorizedException('Hibás email vagy jelszó.');

  const token = await this.signToken(user.tenantId, user.id, user.email, user.isLeader);

  return {
    accessToken: token.accessToken,
    tenant: {
      id: user.tenant.id,
      slug: user.tenant.slug,
      name: user.tenant.name,
    },
  };
}

  /**
   * JWT payload:
   * - sub: userId
   * - tenantId: multi-tenant miatt kötelező
   * - email/isLeader: praktikus a kliensnek is (de nem kötelező)
   */
  private async signToken(tenantId: string, userId: string, email: string, isLeader: boolean) {
    const payload = {
      sub: userId,
      tenantId,
      email,
      isLeader,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return { accessToken };
  }
}
