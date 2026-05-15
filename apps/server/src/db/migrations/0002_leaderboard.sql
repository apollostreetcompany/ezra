CREATE TABLE IF NOT EXISTS leaderboard_profiles (
  user_id text PRIMARY KEY,
  opted_in boolean NOT NULL DEFAULT false,
  display_name text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
