import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PositionsService } from '../positions/positions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ActivityLogService } from '../activity/activity-log.service';

@Controller('admin/positions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPositionsController {
  constructor(
    private positionsService: PositionsService,
    private activity: ActivityLogService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.positionsService.adminListPositions(req.user.tenantId);
  }

  @Post()
  async create(
    @Req() req: any,
    @Body() body: { name: string; parentId?: string | null },
  ) {
    const created = await this.positionsService.adminCreatePosition(
      req.user.tenantId,
      body,
    );
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: req.user.sub,
      event: 'ADMIN_POSITION_CREATED',
      source: 'admin',
      entityType: 'POSITION',
      entityId: created.id,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { name: created.name, parentId: created.parentId },
      request: this.activity.requestMeta(req),
    });
    return created;
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; parentId?: string | null },
  ) {
    const updated = await this.positionsService.adminUpdatePosition(
      req.user.tenantId,
      id,
      body,
    );
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: req.user.sub,
      event: 'ADMIN_POSITION_UPDATED',
      source: 'admin',
      entityType: 'POSITION',
      entityId: id,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { changed: Object.keys(body ?? {}), name: updated.name, parentId: updated.parentId },
      request: this.activity.requestMeta(req),
    });
    return updated;
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const deleted = await this.positionsService.adminDeletePosition(
      req.user.tenantId,
      id,
    );
    await this.activity.log({
      tenantId: req.user.tenantId,
      userId: req.user.sub,
      event: 'ADMIN_POSITION_DELETED',
      source: 'admin',
      entityType: 'POSITION',
      entityId: id,
      actor: { type: 'USER', id: req.user.sub },
      metadata: { name: deleted.name, parentId: deleted.parentId },
      request: this.activity.requestMeta(req),
    });
    return deleted;
  }
}
