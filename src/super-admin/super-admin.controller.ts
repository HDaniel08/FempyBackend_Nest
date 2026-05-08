import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }

  @UseGuards(SuperAdminGuard)
  @Get('audit')
  listAudit(@Query() query: any) {
    return this.service.listPlatformAudit(query);
  }

  @UseGuards(SuperAdminGuard)
  @Post('tenants')
  createTenant(@Body() body: any, @Req() req: any) {
    return this.service.createTenant(body, req.platformAdmin, req);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('tenants/:tenantId/app-access')
  updateTenantAccess(
    @Param('tenantId') tenantId: string,
    @Body() body: { enabled: boolean },
    @Req() req: any,
  ) {
    return this.service.updateTenantAccess(tenantId, !!body.enabled, req.platformAdmin, req);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants/:tenantId/inspector')
  inspectTenant(@Param('tenantId') tenantId: string) {
    return this.service.inspectTenant(tenantId);
  }

  @UseGuards(SuperAdminGuard)
  @Post('tenants/:tenantId/impersonation')
  startTenantImpersonation(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.service.startTenantImpersonation(
      tenantId,
      body,
      req.platformAdmin,
      req,
    );
  }

  @UseGuards(SuperAdminGuard)
  @Post('tenants/:tenantId/impersonation/end')
  endTenantImpersonation(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.service.endTenantImpersonation(
      tenantId,
      body,
      req.platformAdmin,
      req,
    );
  }

  @UseGuards(SuperAdminGuard)
  @Patch('tenants/:tenantId/users/:userId')
  updateTenantUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body()
    body: {
      role?: any;
      isLeader?: boolean;
      isDeleted?: boolean;
      positionId?: string | null;
    },
    @Req() req: any,
  ) {
    return this.service.updateTenantUser(tenantId, userId, body, req.platformAdmin, req);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants/:tenantId/activity')
  listTenantActivity(
    @Param('tenantId') tenantId: string,
    @Query() query: any,
  ) {
    return this.service.listTenantActivity(tenantId, query);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants/:tenantId/activity.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tenant-activity.csv"')
  exportTenantActivity(
    @Param('tenantId') tenantId: string,
    @Query() query: any,
  ) {
    return this.service.exportTenantActivityCsv(tenantId, query);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants/:tenantId/activity/dashboard')
  getTenantActivityDashboard(@Param('tenantId') tenantId: string, @Query() query: any) {
    return this.service.getTenantActivityDashboard(tenantId, query);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants/:tenantId/activity/alerts')
  getTenantActivityAlerts(@Param('tenantId') tenantId: string) {
    return this.service.getTenantActivityAlerts(tenantId);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants/:tenantId/support-sessions')
  listSupportSessions(@Param('tenantId') tenantId: string) {
    return this.service.listSupportSessions(tenantId);
  }

  @UseGuards(SuperAdminGuard)
  @Post('tenants/:tenantId/support-sessions')
  startSupportSession(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.service.startSupportSession(tenantId, body, req.platformAdmin, req);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('tenants/:tenantId/support-sessions/:sessionId/close')
  closeSupportSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: any,
  ) {
    return this.service.closeSupportSession(tenantId, sessionId, req.platformAdmin, req);
  }

  @UseGuards(SuperAdminGuard)
  @Post('activity/cleanup')
  cleanupActivityRetention(@Body() body: any) {
    return this.service.cleanupActivityRetention(body ?? {});
  }

  @UseGuards(SuperAdminGuard)
  @Get('content/surfaces')
  listContentSurfaces() {
    return this.service.listContentSurfaces();
  }

  @UseGuards(SuperAdminGuard)
  @Get('content/topics')
  listContentTopics() {
    return this.service.listContentTopics();
  }

  @UseGuards(SuperAdminGuard)
  @Get('content/items')
  listContentItems(@Query() query: any) {
    return this.service.listContentItems(query);
  }

  @UseGuards(SuperAdminGuard)
  @Post('content/items')
  createContentItem(@Body() body: any) {
    return this.service.createContentItem(body);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('content/items/:id')
  updateContentItem(@Param('id') id: string, @Body() body: any) {
    return this.service.updateContentItem(id, body);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('content/items/:id/archive')
  archiveContentItem(@Param('id') id: string) {
    return this.service.archiveContentItem(id);
  }

  @UseGuards(SuperAdminGuard)
  @Post('content/items/:id/delete')
  deleteContentItem(@Param('id') id: string) {
    return this.service.deleteContentItem(id);
  }

  @UseGuards(SuperAdminGuard)
  @Get('tenants/:tenantId/usage')
  getTenantUsage(@Param('tenantId') tenantId: string, @Query() query: any) {
    return this.service.getTenantUsage(tenantId, query);
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
  sendPush(@Body() body: any, @Req() req: any) {
    return this.service.sendPush(body, req.platformAdmin, req);
  }
}
