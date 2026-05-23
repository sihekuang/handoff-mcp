-- Idempotent seed for the development actor used while auth is deferred.
-- Once auth lands and real users exist, this row is harmless (no real user
-- will have id 'dev_user') — keep the migration in place for reproducibility.
INSERT INTO "user" (id, email, name, email_verified, created_at, updated_at)
VALUES ('dev_user', 'dev@handoff-mcp.local', 'Dev User', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
