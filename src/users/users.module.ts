import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from '../admin/admin-users.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  controllers: [UsersController,AdminUsersController],
  providers: [UsersService],
  exports: [UsersService], // export kell, hogy AuthModule használhassa
})
export class UsersModule {}
