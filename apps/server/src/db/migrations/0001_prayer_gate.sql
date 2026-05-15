CREATE TABLE IF NOT EXISTS block_settings (
  user_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  sync_attestations boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prayer_attestations (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  device_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  repo_hash text NOT NULL,
  branch text,
  commit_sha text
);
