-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "MonitorType" AS ENUM ('HTTP', 'TCP', 'SSL', 'KEYWORD', 'HEARTBEAT');

-- CreateEnum
CREATE TYPE "AlertContactType" AS ENUM ('EMAIL', 'SMS', 'WEBHOOK');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "dodo_customer_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "type" "MonitorType" NOT NULL,
    "interval_seconds" INTEGER NOT NULL,
    "timeout_ms" INTEGER NOT NULL DEFAULT 10000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "keyword_expected" TEXT,
    "keyword_must_exist" BOOLEAN,
    "consecutive_failures_threshold" INTEGER NOT NULL DEFAULT 2,
    "heartbeat_token" TEXT,
    "last_checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_pages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "status_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_page_monitors" (
    "status_page_id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_page_monitors_pkey" PRIMARY KEY ("status_page_id","monitor_id")
);

-- CreateTable
CREATE TABLE "heartbeat_logs" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heartbeat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_results" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL,
    "status_code" INTEGER,
    "latency_ms" INTEGER,
    "is_up" BOOLEAN NOT NULL,
    "error" TEXT,
    "keyword_found" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "cause" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "AlertContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_webhook_events" (
    "id" UUID NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_daily_summaries" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
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
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitor_daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "monitors_heartbeat_token_key" ON "monitors"("heartbeat_token");

-- CreateIndex
CREATE INDEX "monitors_user_id_idx" ON "monitors"("user_id");

-- CreateIndex
CREATE INDEX "monitors_is_active_idx" ON "monitors"("is_active");

-- CreateIndex
CREATE INDEX "monitors_user_id_is_active_type_idx" ON "monitors"("user_id", "is_active", "type");

-- CreateIndex
CREATE UNIQUE INDEX "status_pages_slug_key" ON "status_pages"("slug");

-- CreateIndex
CREATE INDEX "status_pages_user_id_idx" ON "status_pages"("user_id");

-- CreateIndex
CREATE INDEX "status_page_monitors_monitor_id_idx" ON "status_page_monitors"("monitor_id");

-- CreateIndex
CREATE INDEX "heartbeat_logs_monitor_id_idx" ON "heartbeat_logs"("monitor_id");

-- CreateIndex
CREATE INDEX "heartbeat_logs_received_at_idx" ON "heartbeat_logs"("received_at");

-- CreateIndex
CREATE INDEX "heartbeat_logs_monitor_id_received_at_idx" ON "heartbeat_logs"("monitor_id", "received_at");

-- CreateIndex
CREATE INDEX "check_results_monitor_id_idx" ON "check_results"("monitor_id");

-- CreateIndex
CREATE INDEX "check_results_checked_at_idx" ON "check_results"("checked_at");

-- CreateIndex
CREATE INDEX "check_results_is_up_idx" ON "check_results"("is_up");

-- CreateIndex
CREATE INDEX "check_results_monitor_id_checked_at_is_up_idx" ON "check_results"("monitor_id", "checked_at", "is_up");

-- CreateIndex
CREATE INDEX "incidents_monitor_id_idx" ON "incidents"("monitor_id");

-- CreateIndex
CREATE INDEX "incidents_started_at_idx" ON "incidents"("started_at");

-- CreateIndex
CREATE INDEX "incidents_monitor_id_started_at_idx" ON "incidents"("monitor_id", "started_at");

-- CreateIndex
CREATE INDEX "alert_contacts_user_id_idx" ON "alert_contacts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_events_webhook_id_key" ON "billing_webhook_events"("webhook_id");

-- CreateIndex
CREATE INDEX "billing_webhook_events_event_type_idx" ON "billing_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "monitor_daily_summaries_date_idx" ON "monitor_daily_summaries"("date");

-- CreateIndex
CREATE INDEX "monitor_daily_summaries_monitor_id_idx" ON "monitor_daily_summaries"("monitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_daily_summaries_monitor_id_date_key" ON "monitor_daily_summaries"("monitor_id", "date");

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_pages" ADD CONSTRAINT "status_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_status_page_id_fkey" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heartbeat_logs" ADD CONSTRAINT "heartbeat_logs_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_contacts" ADD CONSTRAINT "alert_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_daily_summaries" ADD CONSTRAINT "monitor_daily_summaries_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
