ALTER TABLE "daily_question_schedules"
ADD COLUMN "campaign_day" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "daily_question_dispatches"
ADD COLUMN "campaign_day" INTEGER;

CREATE TABLE "daily_question_campaign_runs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "campaign_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "last_processed_day" INTEGER,
  "last_processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_question_campaign_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "daily_question_campaign_runs_tenant_id_status_idx"
ON "daily_question_campaign_runs"("tenant_id", "status");

CREATE INDEX "daily_question_campaign_runs_campaign_key_status_idx"
ON "daily_question_campaign_runs"("campaign_key", "status");

ALTER TABLE "daily_question_campaign_runs"
ADD CONSTRAINT "daily_question_campaign_runs_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
