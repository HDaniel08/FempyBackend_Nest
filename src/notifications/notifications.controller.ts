import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMatchGuard } from '../auth/tenant-match.guard';
import { Tenant } from '../common/tenant/tenant.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(JwtAuthGuard, TenantMatchGuard)
  @Post('push-test')
  async pushTest(@Tenant() tenant: any, @Req() req: any) {
    return this.notifications.sendNow({
      tenantId: tenant.id,
      userId: req.user.userId,
      type: 'push_test',
      payload: {
        title: 'Fempy teszt',
        body: 'Ha ezt látod, működik a push 🎉',
        data: { kind: 'push_test' },
      },
    });
  }
}
