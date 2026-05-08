import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ContentItemInput = {
  surfaceKey?: string;
  topicId?: string | null;
  topicName?: string | null;
  topicSlug?: string | null;
  title?: string;
  description?: string;
  type?: string;
  duration?: number;
  url?: string;
  source?: string;
  thumbnail?: string | null;
  status?: string;
  language?: string;
  sortOrder?: number;
};

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(surfaceKey: string, query?: { type?: string; topicSlug?: string }) {
    const surface = await this.prisma.contentSurface.findUnique({
      where: { key: surfaceKey },
      select: { id: true, key: true, name: true, isActive: true },
    });
    if (!surface?.isActive) throw new NotFoundException('Content surface not found.');

    return this.prisma.contentItem.findMany({
      where: {
        surfaceId: surface.id,
        status: 'published',
        ...(query?.type ? { type: query.type } : {}),
        ...(query?.topicSlug ? { topic: { slug: query.topicSlug } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { topic: true, surface: true },
    });
  }

  async listSurfaces() {
    return this.prisma.contentSurface.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async listTopics() {
    return this.prisma.contentTopic.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async listAll(query?: { surfaceKey?: string; status?: string; type?: string; topicId?: string }) {
    return this.prisma.contentItem.findMany({
      where: {
        ...(query?.surfaceKey ? { surface: { key: query.surfaceKey } } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.type ? { type: query.type } : {}),
        ...(query?.topicId ? { topicId: query.topicId } : {}),
      },
      orderBy: [{ surface: { name: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { topic: true, surface: true },
    });
  }

  async createItem(input: ContentItemInput) {
    const data = await this.resolveItemData(input, true);
    return this.prisma.contentItem.create({
      data,
      include: { topic: true, surface: true },
    });
  }

  async updateItem(id: string, input: ContentItemInput) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content item not found.');

    const data = await this.resolveItemData(input, false);
    return this.prisma.contentItem.update({
      where: { id },
      data,
      include: { topic: true, surface: true },
    });
  }

  async archiveItem(id: string) {
    return this.updateStatus(id, 'archived');
  }

  async deleteItem(id: string) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content item not found.');
    await this.prisma.contentItem.delete({ where: { id } });
    return { ok: true };
  }

  private async updateStatus(id: string, status: string) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content item not found.');
    return this.prisma.contentItem.update({
      where: { id },
      data: { status },
      include: { topic: true, surface: true },
    });
  }

  private async resolveItemData(input: ContentItemInput, requireAll: boolean) {
    const surfaceKey = input.surfaceKey?.trim() || 'leadership_self';
    const surface = await this.prisma.contentSurface.findUnique({ where: { key: surfaceKey } });
    if (!surface) throw new BadRequestException('Invalid content surface.');

    const topicId = await this.resolveTopicId(input);

    const required = ['title', 'description', 'type', 'duration', 'url', 'source'] as const;
    if (requireAll) {
      for (const field of required) {
        if (input[field] === undefined || input[field] === null || input[field] === '') {
          throw new BadRequestException(`Missing content field: ${field}`);
        }
      }
      if (!input.topicId && !input.topicName && !input.topicSlug) {
        throw new BadRequestException('Missing content topic.');
      }
    }

    const data: any = {
      surfaceId: surface.id,
      ...(topicId !== undefined ? { topicId } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.duration !== undefined ? { duration: Number(input.duration) } : {}),
      ...(input.url !== undefined ? { url: input.url.trim() } : {}),
      ...(input.source !== undefined ? { source: input.source.trim() } : {}),
      ...(input.thumbnail !== undefined ? { thumbnail: input.thumbnail?.trim() || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: Number(input.sortOrder) } : {}),
    };

    if (data.duration !== undefined && (!Number.isFinite(data.duration) || data.duration < 1)) {
      throw new BadRequestException('Duration must be a positive number.');
    }

    return data;
  }

  private async resolveTopicId(input: ContentItemInput) {
    if (Object.prototype.hasOwnProperty.call(input, 'topicId')) {
      return input.topicId || null;
    }

    const name = input.topicName?.trim();
    const slug = input.topicSlug?.trim().toLowerCase();
    if (!name && !slug) return undefined;

    const topicSlug = slug || this.slugify(name ?? '');
    const topic = await this.prisma.contentTopic.upsert({
      where: { slug: topicSlug },
      update: { ...(name ? { name } : {}) },
      create: { slug: topicSlug, name: name || topicSlug },
    });

    return topic.id;
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
