import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  create(input: { name: string; slug: string }) {
    return this.prisma.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        settings: {
          create: {
            orgName: input.name,
            companyForm: 'Kft', // default; később állítható
          },
        },
      },
      include: { settings: true },
    });
  }
}