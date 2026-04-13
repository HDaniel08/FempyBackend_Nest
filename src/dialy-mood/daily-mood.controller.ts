import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DailyMoodService } from "./daily-mood.service";
import { GetDailyMoodHistoryDto, UpsertDailyMoodDto } from "./dto/upsert-daily-mood.dto";
import { UpdateDailyMoodCommentDto } from "./dto/update-daily-mood-comment.dto";

@UseGuards(JwtAuthGuard)
@Controller("daily-mood")
export class DailyMoodController {
  constructor(private dailyMood: DailyMoodService) {}

  @Get("today")
  getToday(@Req() req: any) {
    return this.dailyMood.getToday(req.user);
  }

  @Post("today")
  upsertToday(@Req() req: any, @Body() dto: UpsertDailyMoodDto) {
    return this.dailyMood.upsertToday(req.user, dto);
  }

   @Get("history")
  getHistory(@Req() req: any, @Query() query: GetDailyMoodHistoryDto) {
    return this.dailyMood.getHistory(req.user, query);
  }

  @Patch("today/comment")
  updateTodayComment(@Req() req: any, @Body() dto: UpdateDailyMoodCommentDto) {
    return this.dailyMood.updateTodayComment(req.user, dto);
  }
}