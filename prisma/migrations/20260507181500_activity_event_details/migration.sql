ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_user_id_fkey";

ALTER TABLE "activity_events"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'api',
  ADD COLUMN "entity_type" TEXT,
  ADD COLUMN "entity_id" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "ip_address" TEXT,
  ADD COLUMN "user_agent" TEXT;

CREATE INDEX "activity_events_tenant_id_event_created_at_idx" ON "activity_events"("tenant_id", "event", "created_at" DESC);
CREATE INDEX "activity_events_tenant_id_entity_type_entity_id_idx" ON "activity_events"("tenant_id", "entity_type", "entity_id");

ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
