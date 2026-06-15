ALTER TABLE "notification_jobs" ADD COLUMN "dedupe_key" TEXT;

CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key"
ON "notification_jobs"("dedupe_key");
