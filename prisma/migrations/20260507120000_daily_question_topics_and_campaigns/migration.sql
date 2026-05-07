-- CreateTable
CREATE TABLE "daily_question_topics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_question_topics_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "daily_questions" ADD COLUMN "topic_id" TEXT;

-- AlterTable
ALTER TABLE "daily_question_schedules" ADD COLUMN "campaign_key" TEXT;

-- AlterTable
ALTER TABLE "daily_question_dispatches" ADD COLUMN "campaign_key" TEXT;

-- Backfill topics from existing question topic strings.
INSERT INTO "daily_question_topics" ("id", "tenant_id", "name", "slug", "is_global", "created_at", "updated_at")
SELECT
    md5(coalesce(dq."tenant_id", 'global') || ':' || dq."topic"),
    dq."tenant_id",
    dq."topic",
    lower(regexp_replace(trim(dq."topic"), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(dq."topic"), 1, 6),
    bool_or(dq."is_global"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "daily_questions" dq
WHERE dq."topic" IS NOT NULL AND trim(dq."topic") <> ''
GROUP BY dq."tenant_id", dq."topic";

UPDATE "daily_questions" dq
SET "topic_id" = dqt."id"
FROM "daily_question_topics" dqt
WHERE
    dq."topic" = dqt."name"
    AND (
        dq."tenant_id" = dqt."tenant_id"
        OR (dq."tenant_id" IS NULL AND dqt."tenant_id" IS NULL)
    );

UPDATE "daily_question_dispatches" dqd
SET "campaign_key" = dqs."campaign_key"
FROM "daily_question_schedules" dqs
WHERE dqd."schedule_id" = dqs."id";

-- CreateIndex
CREATE UNIQUE INDEX "daily_question_topics_tenant_id_slug_key" ON "daily_question_topics"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "daily_question_topics_tenant_id_idx" ON "daily_question_topics"("tenant_id");

-- CreateIndex
CREATE INDEX "daily_question_topics_is_global_idx" ON "daily_question_topics"("is_global");

-- CreateIndex
CREATE INDEX "daily_questions_topic_id_idx" ON "daily_questions"("topic_id");

-- CreateIndex
CREATE INDEX "daily_question_schedules_tenant_id_campaign_key_idx" ON "daily_question_schedules"("tenant_id", "campaign_key");

-- CreateIndex
CREATE INDEX "daily_question_dispatches_tenant_id_campaign_key_idx" ON "daily_question_dispatches"("tenant_id", "campaign_key");

-- AddForeignKey
ALTER TABLE "daily_question_topics" ADD CONSTRAINT "daily_question_topics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_questions" ADD CONSTRAINT "daily_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "daily_question_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
