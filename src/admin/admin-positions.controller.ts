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

@Controller('admin/positions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPositionsController {
  constructor(private positionsService: PositionsService) {}

  @Get()
  list(@Req() req: any) {
    return this.positionsService.adminListPositions(req.user.tenantId);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { name: string; parentId?: string | null },
  ) {
    return this.positionsService.adminCreatePosition(
      req.user.tenantId,
      body,
    );
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; parentId?: string | null },
  ) {
    return this.positionsService.adminUpdatePosition(
      req.user.tenantId,
      id,
      body,
    );
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.positionsService.adminDeletePosition(
      req.user.tenantId,
      id,
    );
  }
}