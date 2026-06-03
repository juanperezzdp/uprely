-- CreateTable
CREATE TABLE "monitor_weekly_summaries" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "week_start_date" DATE NOT NULL,
    "week_end_date" DATE NOT NULL,
    "total_checks" INTEGER NOT NULL,
    "up_checks" INTEGER NOT NULL,
    "down_checks" INTEGER NOT NULL,
    "uptime_percentage" DOUBLE PRECISION NOT NULL,
    "avg_latency_ms" DOUBLE PRECISION,
    "min_latency_ms" INTEGER,
    "max_latency_ms" INTEGER,
    "p95_latency_ms" INTEGER,
    "p99_latency_ms" INTEGER,
    "incidents_count" INTEGER NOT NULL DEFAULT 0,
    "total_downtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "days_with_data" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitor_weekly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitor_weekly_summaries_year_week_number_idx" ON "monitor_weekly_summaries"("year", "week_number");

-- CreateIndex
CREATE INDEX "monitor_weekly_summaries_monitor_id_idx" ON "monitor_weekly_summaries"("monitor_id");

-- CreateIndex
CREATE INDEX "monitor_weekly_summaries_week_start_date_idx" ON "monitor_weekly_summaries"("week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_weekly_summaries_monitor_id_year_week_number_key" ON "monitor_weekly_summaries"("monitor_id", "year", "week_number");

-- AddForeignKey
ALTER TABLE "monitor_weekly_summaries" ADD CONSTRAINT "monitor_weekly_summaries_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
