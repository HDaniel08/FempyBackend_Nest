CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "platform_admin_id" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "activity_events"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'APP',
  ADD COLUMN "support_session_id" TEXT;

UPDATE "activity_events"
SET "category" = CASE
  WHEN "event" LIKE 'SUPER_ADMIN_%' OR "event" LIKE 'ADMIN_%' THEN 'AUDIT'
  WHEN "event" LIKE 'SYSTEM_%' THEN 'SYSTEM'
  ELSE 'APP'
END;

CREATE INDEX "support_sessions_tenant_id_status_started_at_idx" ON "support_sessions"("tenant_id", "status", "started_at" DESC);
CREATE INDEX "support_sessions_platform_admin_id_started_at_idx" ON "support_sessions"("platform_admin_id", "started_at" DESC);
CREATE INDEX "activity_events_tenant_id_category_created_at_idx" ON "activity_events"("tenant_id", "category", "created_at" DESC);
CREATE INDEX "activity_events_tenant_id_support_session_id_created_at_idx" ON "activity_events"("tenant_id", "support_session_id", "created_at" DESC);

ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_support_session_id_fkey" FOREIGN KEY ("support_session_id") REFERENCES "support_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
