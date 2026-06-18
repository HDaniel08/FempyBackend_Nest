CREATE TABLE "app_version_policies" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "min_ios_version" TEXT NOT NULL DEFAULT '1.0.8',
    "min_ios_build_number" INTEGER NOT NULL DEFAULT 9,
    "latest_ios_version" TEXT NOT NULL DEFAULT '1.0.8',
    "latest_ios_build_number" INTEGER NOT NULL DEFAULT 9,
    "ios_store_url" TEXT NOT NULL DEFAULT 'https://apps.apple.com/hu/app/fempy/id6762603045',
    "min_android_version" TEXT NOT NULL DEFAULT '1.0.8',
    "min_android_version_code" INTEGER NOT NULL DEFAULT 9,
    "latest_android_version" TEXT NOT NULL DEFAULT '1.0.8',
    "latest_android_version_code" INTEGER NOT NULL DEFAULT 9,
    "android_store_url" TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.fempy.rework.app',
    "backend_version" TEXT NOT NULL DEFAULT '1.0.0',
    "force_update_message" TEXT NOT NULL DEFAULT 'Az alkalmazas ujabb verzioja szukseges a folytatashoz. Kerlek frissitsd a Fempy appot.',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_version_policies_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_version_policies" (
    "id",
    "updated_at"
) VALUES (
    'global',
    CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
