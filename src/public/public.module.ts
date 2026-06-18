import { Module } from '@nestjs/common';
import { AppVersionModule } from '../app-version/app-version.module';
import { PublicController } from './public.controller';

@Module({
  imports: [AppVersionModule],
  controllers: [PublicController],
})
export class PublicModule {}
