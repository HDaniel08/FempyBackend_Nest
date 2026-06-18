import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Platform = 'ios' | 'android';

const POLICY_ID = 'global';

const EDITABLE_FIELDS = [
  'minIosVersion',
  'minIosBuildNumber',
  'latestIosVersion',
  'latestIosBuildNumber',
  'iosStoreUrl',
  'minAndroidVersion',
  'minAndroidVersionCode',
  'latestAndroidVersion',
  'latestAndroidVersionCode',
  'androidStoreUrl',
  'backendVersion',
  'forceUpdateMessage',
] as const;

@Injectable()
export class AppVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy() {
    return this.prisma.appVersionPolicy.upsert({
      where: { id: POLICY_ID },
      create: { id: POLICY_ID },
      update: {},
    });
  }

  async updatePolicy(input: Record<string, any>) {
    const data: Record<string, any> = {};

    for (const field of EDITABLE_FIELDS) {
      if (!(field in input)) continue;
      const value = input[field];

      if (field.endsWith('BuildNumber') || field.endsWith('VersionCode')) {
        const numberValue = Number(value);
        if (!Number.isInteger(numberValue) || numberValue < 1) {
          throw new BadRequestException(`${field} must be a positive integer.`);
        }
        data[field] = numberValue;
        continue;
      }

      const stringValue = String(value ?? '').trim();
      if (!stringValue) {
        throw new BadRequestException(`${field} is required.`);
      }
      data[field] = stringValue;
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException('Nincs frissitheto verzio mezo.');
    }

    return this.prisma.appVersionPolicy.update({
      where: { id: POLICY_ID },
      data,
    });
  }

  async checkClient(input: {
    platform?: string;
    version?: string;
    buildNumber?: string | number;
  }) {
    const policy = await this.getPolicy();
    const platform = this.normalizePlatform(input.platform);

    if (!platform) {
      return {
        supported: true,
        requiresUpdate: false,
        reason: 'unknown_platform',
        policy,
      };
    }

    const buildNumber = this.toOptionalInt(input.buildNumber);
    const version = String(input.version ?? '').trim();
    const required =
      platform === 'ios'
        ? {
            minVersion: policy.minIosVersion,
            minBuild: policy.minIosBuildNumber,
            latestVersion: policy.latestIosVersion,
            latestBuild: policy.latestIosBuildNumber,
            storeUrl: policy.iosStoreUrl,
          }
        : {
            minVersion: policy.minAndroidVersion,
            minBuild: policy.minAndroidVersionCode,
            latestVersion: policy.latestAndroidVersion,
            latestBuild: policy.latestAndroidVersionCode,
            storeUrl: policy.androidStoreUrl,
          };

    const buildTooOld =
      buildNumber !== null ? buildNumber < required.minBuild : false;
    const versionTooOld = version
      ? compareVersions(version, required.minVersion) < 0
      : buildNumber === null;
    const requiresUpdate = buildTooOld || versionTooOld;

    return {
      supported: !requiresUpdate,
      requiresUpdate,
      reason: requiresUpdate ? 'client_version_too_old' : 'ok',
      platform,
      current: {
        version: version || null,
        buildNumber,
      },
      required,
      backendVersion: policy.backendVersion,
      message: policy.forceUpdateMessage,
      updatedAt: policy.updatedAt,
    };
  }

  private normalizePlatform(platform?: string): Platform | null {
    const value = String(platform ?? '').toLowerCase();
    if (value === 'ios') return 'ios';
    if (value === 'android') return 'android';
    return null;
  }

  private toOptionalInt(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const numberValue = Number(value);
    return Number.isInteger(numberValue) ? numberValue : null;
  }
}

function compareVersions(a: string, b: string) {
  const left = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const max = Math.max(left.length, right.length);

  for (let index = 0; index < max; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}
