/*
  Warnings:

  - The primary key for the `daily_mood` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `day` on the `daily_mood` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenant_id,user_id,date]` on the table `daily_mood` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date` to the `daily_mood` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `daily_mood` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updated_at` to the `daily_mood` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "daily_mood_tenant_id_day_idx";

-- AlterTable
ALTER TABLE "daily_mood" DROP CONSTRAINT "daily_mood_pkey",
DROP COLUMN "day",
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "daily_mood_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "daily_mood_tenant_id_date_idx" ON "daily_mood"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_mood_tenant_id_user_id_date_key" ON "daily_mood"("tenant_id", "user_id", "date");
