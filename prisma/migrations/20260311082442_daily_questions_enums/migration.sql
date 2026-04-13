/*
  Warnings:

  - Changed the type of `schedule_type` on the `daily_question_schedules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `audience_type` on the `daily_question_schedules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `daily_questions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DailyQuestionType" AS ENUM ('SINGLE_CHOICE_5');

-- CreateEnum
CREATE TYPE "DailyQuestionScheduleType" AS ENUM ('MANUAL', 'CRON', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "DailyQuestionAudienceType" AS ENUM ('ALL', 'POSITION', 'DEPARTMENT', 'GROUP', 'ACTIVITY', 'CUSTOM');

-- AlterTable
ALTER TABLE "daily_question_schedules" DROP COLUMN "schedule_type",
ADD COLUMN     "schedule_type" "DailyQuestionScheduleType" NOT NULL,
DROP COLUMN "audience_type",
ADD COLUMN     "audience_type" "DailyQuestionAudienceType" NOT NULL;

-- AlterTable
ALTER TABLE "daily_questions" DROP COLUMN "type",
ADD COLUMN     "type" "DailyQuestionType" NOT NULL;

-- CreateIndex
CREATE INDEX "daily_question_schedules_schedule_type_idx" ON "daily_question_schedules"("schedule_type");
