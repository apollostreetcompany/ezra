CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  device_name text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS plans (
  id text NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  goal text NOT NULL,
  days integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS plan_items (
  id text NOT NULL,
  plan_id text NOT NULL,
  user_id text NOT NULL,
  day integer NOT NULL,
  reference text NOT NULL,
  kind text NOT NULL,
  prompt text,
  PRIMARY KEY (plan_id, id)
);

CREATE TABLE IF NOT EXISTS progress_events (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  device_id text NOT NULL,
  idempotency_key text NOT NULL,
  plan_id text NOT NULL,
  reference_id text NOT NULL,
  action text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS review_events (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  device_id text NOT NULL,
  idempotency_key text NOT NULL,
  card_id text NOT NULL,
  rating integer NOT NULL,
  occurred_at timestamptz NOT NULL,
  scheduler_before_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduler_after_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  user_id text,
  device_id text,
  event text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
