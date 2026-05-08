import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMatchGuard } from '../auth/tenant-match.guard';
import { UsageService } from './usage.service';

@UseGuards(JwtAuthGuard, TenantMatchGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Post('heartbeat')
  heartbeat(@Req() req: any, @Body() body: any) {
    return this.usage.heartbeat(req.user, body ?? {});
  }

  @Post('end')
  end(@Req() req: any, @Body() body: any) {
    return this.usage.end(req.user, body ?? {});
  }
}
