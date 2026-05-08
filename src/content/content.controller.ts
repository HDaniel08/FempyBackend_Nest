import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContentService } from './content.service';

@UseGuards(JwtAuthGuard)
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('surfaces/:surfaceKey/items')
  listSurfaceItems(@Param('surfaceKey') surfaceKey: string, @Query() query: any) {
    return this.content.listPublished(surfaceKey, query);
  }
}
