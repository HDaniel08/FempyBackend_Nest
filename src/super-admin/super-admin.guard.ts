import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization || '';
    const [type, token] = String(header).split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Hiányzó superadmin token.');
    }

    try {
      const payload = await this.jwt.verifyAsync(token);
      if (payload?.scope !== 'platform-admin' || !payload?.sub) {
        throw new UnauthorizedException('Érvénytelen superadmin token.');
      }
      req.platformAdmin = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Érvénytelen superadmin token.');
    }
  }
}
