-- Webhook and Slack notification settings per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
