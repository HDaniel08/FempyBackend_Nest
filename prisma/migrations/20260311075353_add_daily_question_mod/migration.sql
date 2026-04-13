/*
  Warnings:

  - A unique constraint covering the columns `[dispatch_id,user_id]` on the table `daily_questionnaire_answers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dispatch_id` to the `daily_questionnaire_answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `daily_questions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "daily_questionnaire_answers" ADD COLUMN     "dispatch_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "daily_questions" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_global" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "daily_question_schedules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "question_id" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default_weekday_morning" BOOLEAN NOT NULL DEFAULT false,
    "schedule_type" TEXT NOT NULL,
    "cron_expr" TEXT,
    "run_at" TIMESTAMP(3),
    "audience_type" TEXT NOT NULL DEFAULT 'ALL',
    "audience_config" JSONB,
    "push_title" TEXT,
    "push_body" TEXT,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_question_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_question_dispatches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "question_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "triggered_by_user_id" TEXT,
    "sent_on" DATE NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "audience_type" TEXT NOT NULL DEFAULT 'ALL',
    "audience_config" JSONB,
    "push_sent" BOOLEAN NOT NULL DEFAULT false,
    "push_title" TEXT,
    "push_body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_question_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_question_schedules_tenant_id_is_active_idx" ON "daily_question_schedules"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "daily_question_schedules_question_id_idx" ON "daily_question_schedules"("question_id");

-- CreateIndex
CREATE INDEX "daily_question_schedules_schedule_type_idx" ON "daily_question_schedules"("schedule_type");

-- CreateIndex
CREATE INDEX "daily_question_schedules_run_at_idx" ON "daily_question_schedules"("run_at");

-- CreateIndex
CREATE INDEX "daily_question_dispatches_tenant_id_sent_on_idx" ON "daily_question_dispatches"("tenant_id", "sent_on");

-- CreateIndex
CREATE INDEX "daily_question_dispatches_question_id_idx" ON "daily_question_dispatches"("question_id");

-- CreateIndex
CREATE INDEX "daily_question_dispatches_schedule_id_idx" ON "daily_question_dispatches"("schedule_id");

-- CreateIndex
CREATE INDEX "daily_questionnaire_answers_dispatch_id_idx" ON "daily_questionnaire_answers"("dispatch_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_questionnaire_answers_dispatch_id_user_id_key" ON "daily_questionnaire_answers"("dispatch_id", "user_id");

-- CreateIndex
CREATE INDEX "daily_questions_is_active_idx" ON "daily_questions"("is_active");

-- CreateIndex
CREATE INDEX "daily_questions_is_global_idx" ON "daily_questions"("is_global");

-- AddForeignKey
ALTER TABLE "daily_question_schedules" ADD CONSTRAINT "daily_question_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_question_schedules" ADD CONSTRAINT "daily_question_schedules_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "daily_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_question_dispatches" ADD CONSTRAINT "daily_question_dispatches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_question_dispatches" ADD CONSTRAINT "daily_question_dispatches_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "daily_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_question_dispatches" ADD CONSTRAINT "daily_question_dispatches_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "daily_question_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_questionnaire_answers" ADD CONSTRAINT "daily_questionnaire_answers_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "daily_question_dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
