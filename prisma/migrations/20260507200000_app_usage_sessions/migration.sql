CREATE TABLE "app_usage_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "heartbeat_count" INTEGER NOT NULL DEFAULT 0,
    "platform" TEXT,
    "app_version" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_usage_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_usage_sessions_tenant_id_started_at_idx" ON "app_usage_sessions"("tenant_id", "started_at" DESC);
CREATE INDEX "app_usage_sessions_tenant_id_user_id_started_at_idx" ON "app_usage_sessions"("tenant_id", "user_id", "started_at" DESC);
CREATE INDEX "app_usage_sessions_tenant_id_duration_seconds_idx" ON "app_usage_sessions"("tenant_id", "duration_seconds" DESC);
CREATE INDEX "app_usage_sessions_tenant_id_status_last_seen_at_idx" ON "app_usage_sessions"("tenant_id", "status", "last_seen_at");

ALTER TABLE "app_usage_sessions" ADD CONSTRAINT "app_usage_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_usage_sessions" ADD CONSTRAINT "app_usage_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
