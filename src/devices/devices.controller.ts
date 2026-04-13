import { Body, Controller, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMatchGuard } from '../auth/tenant-match.guard';
import { Tenant } from '../common/tenant/tenant.decorator';

@Controller('devices')
export class DevicesController {
  constructor(private devices: DevicesService) {}

  @UseGuards(JwtAuthGuard, TenantMatchGuard)
  @Post('register')
  async register(@Tenant() tenant: any, @Req() req: any, @Body() body: RegisterDeviceDto) {
    const user = req.user;

    const userId = user?.sub ?? user?.userId ?? user?.id;

    if (!tenant?.id) {
      throw new BadRequestException('Missing tenant in request context');
    }

    if (!userId) {
      throw new BadRequestException('Missing userId in request context');
    }

    return this.devices.registerDevice({
      tenantId: tenant.id,
      userId,
      expoToken: body.expoToken,
      deviceInfo: body.deviceInfo,
    });
  }
}