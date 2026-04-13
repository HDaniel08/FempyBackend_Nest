/*
  Warnings:

  - You are about to drop the `Tenant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";

-- DropTable
DROP TABLE "Tenant";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "tenant_id" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "company_form" TEXT NOT NULL,
    "tax_number" TEXT,
    "company_address" TEXT,
    "work_days" JSONB,
    "work_start" TIME,
    "work_end" TIME,
    "company_goals" TEXT,
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "notify_push" BOOLEAN NOT NULL DEFAULT false,
    "notify_workday_only" BOOLEAN NOT NULL DEFAULT false,
    "notify_start" TIME,
    "notify_end" TIME,
    "default_lang" TEXT NOT NULL DEFAULT 'hu',
    "theme_mode" TEXT NOT NULL DEFAULT 'light',
    "time_zone" TEXT NOT NULL DEFAULT 'Europe/Budapest',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "position_id" TEXT,
    "is_leader" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nickname" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "birthday" DATE,
    "gender" INTEGER,
    "date_of_start" DATE,
    "description" TEXT,
    "own_goal" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "on_holiday" BOOLEAN NOT NULL DEFAULT false,
    "less_notification" BOOLEAN NOT NULL DEFAULT false,
    "email_notification" BOOLEAN NOT NULL DEFAULT false,
    "daily_notification" BOOLEAN NOT NULL DEFAULT true,
    "profile_pic" TEXT NOT NULL DEFAULT '1',

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "daily_mood" (
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "mood" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_mood_pkey" PRIMARY KEY ("tenant_id","user_id","day")
);

-- CreateTable
CREATE TABLE "daily_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "topic" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer_options" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "hungarian_norm" DECIMAL(5,2),
    "hungarian_std" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_questionnaire_answers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sent_on" DATE NOT NULL,
    "filled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_questionnaire_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expo_token" TEXT NOT NULL,
    "device_info" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "scheduled_for" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "positions_tenant_id_idx" ON "positions"("tenant_id");

-- CreateIndex
CREATE INDEX "positions_tenant_id_parent_id_idx" ON "positions"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_tenant_id_name_parent_id_key" ON "positions"("tenant_id", "name", "parent_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_position_id_idx" ON "users"("tenant_id", "position_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "user_profile_tenant_id_idx" ON "user_profile"("tenant_id");

-- CreateIndex
CREATE INDEX "daily_mood_tenant_id_day_idx" ON "daily_mood"("tenant_id", "day");

-- CreateIndex
CREATE INDEX "daily_questions_tenant_id_idx" ON "daily_questions"("tenant_id");

-- CreateIndex
CREATE INDEX "daily_questionnaire_answers_tenant_id_user_id_sent_on_idx" ON "daily_questionnaire_answers"("tenant_id", "user_id", "sent_on");

-- CreateIndex
CREATE INDEX "daily_questionnaire_answers_tenant_id_question_id_idx" ON "daily_questionnaire_answers"("tenant_id", "question_id");

-- CreateIndex
CREATE INDEX "activity_events_tenant_id_created_at_idx" ON "activity_events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_events_tenant_id_user_id_created_at_idx" ON "activity_events"("tenant_id", "user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_devices_tenant_id_user_id_idx" ON "user_devices"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_tenant_id_expo_token_key" ON "user_devices"("tenant_id", "expo_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_tenant_id_user_id_expo_token_key" ON "user_devices"("tenant_id", "user_id", "expo_token");

-- CreateIndex
CREATE INDEX "notification_jobs_tenant_id_status_created_at_idx" ON "notification_jobs"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_jobs_tenant_id_scheduled_for_idx" ON "notification_jobs"("tenant_id", "scheduled_for");

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_mood" ADD CONSTRAINT "daily_mood_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_mood" ADD CONSTRAINT "daily_mood_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_questions" ADD CONSTRAINT "daily_questions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_questionnaire_answers" ADD CONSTRAINT "daily_questionnaire_answers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_questionnaire_answers" ADD CONSTRAINT "daily_questionnaire_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_questionnaire_answers" ADD CONSTRAINT "daily_questionnaire_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "daily_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
