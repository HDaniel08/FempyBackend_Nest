// src/positions/positions.module.ts

import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPositionsController } from '../admin/admin-positions.controller';

@Module({
  providers: [PositionsService, PrismaService],
  controllers: [AdminPositionsController],
  exports: [PositionsService],
})
export class PositionsModule {}