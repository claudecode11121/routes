-- TelegramUser table (PostgreSQL)
CREATE TABLE IF NOT EXISTS telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL UNIQUE,
  username text DEFAULT 'User',
  temp_ids text[] DEFAULT '{}',  -- array of temp IDs (shipments)
  current_session jsonb DEFAULT '{
    "state": "IDLE",
    "tempId": null,
    "lastInteraction": null,
    "context": null
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_telegram_users_chat_id ON telegram_users (chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_created_at ON telegram_users (created_at DESC);

-- Trigger to keep updated_at current
DROP TRIGGER IF EXISTS set_timestamp_telegram_users ON telegram_users;
CREATE TRIGGER set_timestamp_telegram_users
BEFORE UPDATE ON telegram_users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
