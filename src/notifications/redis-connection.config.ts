import { ConfigService } from '@nestjs/config';

export type RedisConnectionOptions = {
  host: string;
  port: number;
  family: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  connectTimeout: number;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
};

type RedisEnvSource = {
  key: string;
  value: string;
};

export function getRedisEnvSource(config: ConfigService): RedisEnvSource | null {
  const entries = [
    ['REDIS_URL', config.get<string>('REDIS_URL')],
    ['REDIS_PRIVATE_URL', config.get<string>('REDIS_PRIVATE_URL')],
    ['REDIS_PUBLIC_URL', config.get<string>('REDIS_PUBLIC_URL')],
    ['REDIS_TLS_URL', config.get<string>('REDIS_TLS_URL')],
  ] as const;

  const match = entries.find(([, value]) => !!value?.trim());
  return match ? { key: match[0], value: match[1]!.trim() } : null;
}

export function buildRedisConnectionOptions(
  config: ConfigService,
): RedisConnectionOptions {
  const source = getRedisEnvSource(config);
  const connectTimeout = Number(
    config.get<string>('REDIS_CONNECT_TIMEOUT_MS') ?? 10000,
  );

  if (source) {
    const url = new URL(source.value);
    const tlsEnabled =
      url.protocol === 'rediss:' || config.get<string>('REDIS_TLS') === 'true';

    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      family: Number(config.get<string>('REDIS_FAMILY') ?? 0),
      username:
        decodeURIComponent(url.username) ||
        config.get<string>('REDIS_USERNAME') ||
        undefined,
      password:
        decodeURIComponent(url.password) ||
        config.get<string>('REDIS_PASSWORD') ||
        undefined,
      tls: tlsEnabled ? {} : undefined,
      connectTimeout,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  return {
    host:
      config.get<string>('REDIS_HOST') ??
      config.get<string>('REDISHOST') ??
      'localhost',
    port: Number(
      config.get<string>('REDIS_PORT') ??
        config.get<string>('REDISPORT') ??
        6379,
    ),
    family: Number(config.get<string>('REDIS_FAMILY') ?? 0),
    username:
      config.get<string>('REDIS_USERNAME') ||
      config.get<string>('REDISUSER') ||
      undefined,
    password:
      config.get<string>('REDIS_PASSWORD') ||
      config.get<string>('REDISPASSWORD') ||
      undefined,
    tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
    connectTimeout,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function describeRedisConnection(
  config: ConfigService,
  connection = buildRedisConnectionOptions(config),
) {
  const source = getRedisEnvSource(config);

  return {
    source: source?.key ?? 'REDIS_HOST/REDISHOST',
    host: connection.host,
    port: connection.port,
    family: connection.family,
    username: connection.username ?? null,
    hasPassword: !!connection.password,
    tls: !!connection.tls,
    connectTimeout: connection.connectTimeout,
  };
}
