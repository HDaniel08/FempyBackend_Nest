import { Body, Controller, Post } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Post()
  create(@Body() body: { name: string; slug: string }) {
    return this.tenants.create(body);
  }
}