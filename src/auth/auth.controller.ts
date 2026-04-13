import { Body, Controller, Get, Post,Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Tenant } from '../common/tenant/tenant.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { TenantMatchGuard } from './tenant-match.guard';
/**
 * AuthController:
 * - /auth/register: tenanton belül regisztráció
 * - /auth/login: tenanton belül login
 * - /auth/me: védett endpoint, tokenből azonosít
 */
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private users: UsersService,
  ) {}

  @Post('register')
  async register(@Tenant() tenant: any, @Body() body: RegisterDto) {
    // tenant.id a middlewareből jön
    return this.auth.register(tenant.id, body);
  }

  @Post('login')
  async login(@Tenant() tenant: any, @Body() body: LoginDto) {
    return this.auth.login(tenant.id, body);
  }
  @Post('login-global')
async loginGlobal(@Body() body: LoginDto) {
  return this.auth.loginGlobal(body);
}

  /**
   * /auth/me:
   * - Bearer token kell hozzá
   * - visszaadjuk a bejelentkezett user részletes adatait tenanton belül
   */
@UseGuards(JwtAuthGuard, TenantMatchGuard)
  @Get('me')
  async me(@Tenant() tenant: any, @Req() req: any) {
    const user = req.user;
    return this.users.getUserWithDetails(tenant.id, user.userId);
  }
}
