import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppVersionService } from './app-version.service';

@Module({
  imports: [PrismaModule],
  providers: [AppVersionService],
  exports: [AppVersionService],
})
export class AppVersionModule {}
