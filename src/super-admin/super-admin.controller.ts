import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';
import { SuperAdminService } from './super-admin.service';

@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.service.login(body);
  }

  @UseGuards(SuperAdminGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.service.me(req.platformAdmin.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants')
  listTenants() {
    return this.service.listTenants();
  }

  @UseGuards(SuperAdminGuard)
  @Post('tenants')
  createTenant(@Body() body: any) {
    return this.service.createTenant(body);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('tenants/:tenantId/app-access')
  updateTenantAccess(
    @Param('tenantId') tenantId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.service.updateTenantAccess(tenantId, !!body.enabled);
  }

  @UseGuards(SuperAdminGuard)
  @Get('campaigns')
  listCampaigns() {
    return this.service.listCampaigns();
  }

  @UseGuards(SuperAdminGuard)
  @Post('push/preview')
  previewPush(@Body() body: any) {
    return this.service.previewPush(body?.filters ?? {});
  }

  @UseGuards(SuperAdminGuard)
  @Post('push/send')
  sendPush(@Body() body: any) {
    return this.service.sendPush(body);
  }
}
