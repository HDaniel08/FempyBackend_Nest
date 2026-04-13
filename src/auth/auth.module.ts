import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms'; // ✅ ez a "7d" típus

import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET nincs beállítva a .env-ben');

        // env-ből jön, de típus szerint "ms" stringként kezeljük (pl. '7d', '1h')
        const expires = (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as StringValue;

        return {
          secret,
          signOptions: { expiresIn: expires },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
