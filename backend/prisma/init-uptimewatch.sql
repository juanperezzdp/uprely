CREATE DATABASE uptimewatch;

\connect uptimewatch;

CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan') THEN
    CREATE TYPE plan AS ENUM ('FREE', 'PRO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'monitor_type') THEN
    CREATE TYPE monitor_type AS ENUM ('HTTP', 'TCP', 'SSL', 'KEYWORD', 'HEARTBEAT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_contact_type') THEN
    CREATE TYPE alert_contact_type AS ENUM ('EMAIL', 'SMS', 'WEBHOOK');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan plan NOT NULL DEFAULT 'FREE',
  dodo_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS monitors (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  type monitor_type NOT NULL,
  interval_seconds INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  keyword_expected TEXT,
  keyword_must_exist BOOLEAN,
  consecutive_failures_threshold INTEGER NOT NULL DEFAULT 2,
  heartbeat_token TEXT UNIQUE,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monitors_user_id_idx ON monitors (user_id);
CREATE INDEX IF NOT EXISTS monitors_is_active_idx ON monitors (is_active);
CREATE INDEX IF NOT EXISTS monitors_user_id_is_active_type_idx ON monitors (user_id, is_active, type);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY,
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cause TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_monitor_id_idx ON incidents (monitor_id);
CREATE INDEX IF NOT EXISTS incidents_started_at_idx ON incidents (started_at);
CREATE INDEX IF NOT EXISTS incidents_monitor_id_started_at_idx ON incidents (monitor_id, started_at);

CREATE TABLE IF NOT EXISTS incident_embeddings (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incident_embeddings_incident_id_idx ON incident_embeddings (incident_id);

CREATE INDEX IF NOT EXISTS incident_embedding_hnsw_idx
ON incident_embeddings
USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS alert_contacts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type alert_contact_type NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alert_contacts_user_id_idx ON alert_contacts (user_id);

CREATE TABLE IF NOT EXISTS check_results (
  id UUID PRIMARY KEY,
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER,
  is_up BOOLEAN NOT NULL,
  error TEXT,
  keyword_found BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS check_results_monitor_id_idx ON check_results (monitor_id);
CREATE INDEX IF NOT EXISTS check_results_checked_at_idx ON check_results (checked_at);
CREATE INDEX IF NOT EXISTS check_results_is_up_idx ON check_results (is_up);
CREATE INDEX IF NOT EXISTS check_results_monitor_id_checked_at_is_up_idx ON check_results (monitor_id, checked_at, is_up);

CREATE TABLE IF NOT EXISTS heartbeat_logs (
  id UUID PRIMARY KEY,
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS heartbeat_logs_monitor_id_idx ON heartbeat_logs (monitor_id);
CREATE INDEX IF NOT EXISTS heartbeat_logs_received_at_idx ON heartbeat_logs (received_at);
CREATE INDEX IF NOT EXISTS heartbeat_logs_monitor_id_received_at_idx ON heartbeat_logs (monitor_id, received_at);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id UUID PRIMARY KEY,
  webhook_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_webhook_events_event_type_idx ON billing_webhook_events (event_type);

CREATE TABLE IF NOT EXISTS status_pages (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS status_pages_user_id_idx ON status_pages (user_id);

CREATE TABLE IF NOT EXISTS status_page_monitors (
  status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (status_page_id, monitor_id)
);

CREATE INDEX IF NOT EXISTS status_page_monitors_monitor_id_idx ON status_page_monitors (monitor_id);
