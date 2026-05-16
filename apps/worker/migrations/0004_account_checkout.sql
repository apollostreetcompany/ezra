-- Ezra MCP account and checkout hardening.
-- Public checkout, magic-link login, API-key creation, and billing portal access
-- all converge on normalized email users.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_magic_links_email_created
  ON magic_links(email, created_at);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_scopes_created
  ON device_tokens(user_id, scopes, created_at);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_user
  ON stripe_customers(user_id);
