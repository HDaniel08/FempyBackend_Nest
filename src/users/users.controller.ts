import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { UpdateMyProfileDto } from "./dto/update-my-profile.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";

import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import * as fs from "fs";





@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() req: any) {
    return this.usersService.getMe(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/profile")
  async updateMyProfile(@Req() req: any, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/goals")
  async getMyGoals(@Req() req: any) {
    return this.usersService.getMyGoals(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/goals")
  async createMyGoal(@Req() req: any, @Body() dto: CreateGoalDto) {
    return this.usersService.createMyGoal(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("me/goals/:goalId")
  async deleteMyGoal(@Req() req: any, @Param("goalId") goalId: string) {
    return this.usersService.deleteMyGoal(req.user, goalId);
  }

 
}