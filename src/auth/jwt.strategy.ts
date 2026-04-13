import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    // 1) Előbb kiolvassuk és validáljuk a secretet
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      // Ha nincs secret, már induláskor álljon meg, ne runtime hibázzon
      throw new Error('JWT_SECRET nincs beállítva a .env-ben');
    }

    // 2) Csak ezután hívjuk a super()-t, immár garantált stringgel
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, // ✅ már biztosan string
    });
  }

  async validate(payload: any) {
    if (!payload?.sub || !payload?.tenantId) {
      throw new UnauthorizedException('Érvénytelen token.');
    }

    return {
      sub: payload.sub,  
      tenantId: payload.tenantId,
      email: payload.email,
      isLeader: payload.isLeader,
    };
  }
}
