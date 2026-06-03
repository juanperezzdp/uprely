-- CreateTable
CREATE TABLE "monitor_monthly_summaries" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "month_start_date" DATE NOT NULL,
    "month_end_date" DATE NOT NULL,
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
    "weeks_with_data" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitor_monthly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_yearly_summaries" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "year_start_date" DATE NOT NULL,
    "year_end_date" DATE NOT NULL,
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
    "months_with_data" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitor_yearly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitor_monthly_summaries_year_month_idx" ON "monitor_monthly_summaries"("year", "month");

-- CreateIndex
CREATE INDEX "monitor_monthly_summaries_monitor_id_idx" ON "monitor_monthly_summaries"("monitor_id");

-- CreateIndex
CREATE INDEX "monitor_monthly_summaries_month_start_date_idx" ON "monitor_monthly_summaries"("month_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_monthly_summaries_monitor_id_year_month_key" ON "monitor_monthly_summaries"("monitor_id", "year", "month");

-- CreateIndex
CREATE INDEX "monitor_yearly_summaries_year_idx" ON "monitor_yearly_summaries"("year");

-- CreateIndex
CREATE INDEX "monitor_yearly_summaries_monitor_id_idx" ON "monitor_yearly_summaries"("monitor_id");

-- CreateIndex
CREATE INDEX "monitor_yearly_summaries_year_start_date_idx" ON "monitor_yearly_summaries"("year_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_yearly_summaries_monitor_id_year_key" ON "monitor_yearly_summaries"("monitor_id", "year");

-- AddForeignKey
ALTER TABLE "monitor_monthly_summaries" ADD CONSTRAINT "monitor_monthly_summaries_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_yearly_summaries" ADD CONSTRAINT "monitor_yearly_summaries_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
