-- TempShipment table (PostgreSQL)
CREATE TABLE IF NOT EXISTS temp_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temp_id text NOT NULL UNIQUE,
  sender jsonb,
  receiver jsonb,
  items jsonb DEFAULT '[]'::jsonb,
  origin text,
  destination text,
  status text DEFAULT 'Pending Receiver Info',
  telegram_chat_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_temp_shipments_created_at ON temp_shipments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_temp_shipments_telegram_chat_id ON temp_shipments (telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_temp_shipments_temp_id ON temp_shipments (temp_id);

-- Trigger to keep updated_at current
DROP TRIGGER IF EXISTS set_timestamp_temp_shipments ON temp_shipments;
CREATE TRIGGER set_timestamp_temp_shipments
BEFORE UPDATE ON temp_shipments
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
