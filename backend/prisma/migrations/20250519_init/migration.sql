-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "activities" (
    "id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "sport_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "start_date_local" TIMESTAMP(3) NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "moving_time" INTEGER NOT NULL,
    "elapsed_time" INTEGER NOT NULL,
    "total_elevation_gain" DOUBLE PRECISION NOT NULL,
    "average_speed" DOUBLE PRECISION NOT NULL,
    "max_speed" DOUBLE PRECISION NOT NULL,
    "average_heartrate" DOUBLE PRECISION,
    "max_heartrate" DOUBLE PRECISION,
    "suffer_score" INTEGER,
    "total_photo_count" INTEGER,
    "category" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "race_type" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_filename_key" ON "plans"("filename");

-- CreateIndex
CREATE INDEX "activities_fetched_at_idx" ON "activities"("fetched_at" DESC);

-- CreateIndex
CREATE INDEX "activities_start_date_idx" ON "activities"("start_date" DESC);

