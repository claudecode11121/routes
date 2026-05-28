-- Tracking table (PostgreSQL)
CREATE TABLE IF NOT EXISTS trackings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number text NOT NULL UNIQUE,
  sender jsonb,               -- { name, address, phone, email, destinationOffice }
  receiver jsonb,             -- { name, address, phone, email, destinationOffice }
  origin text NOT NULL,
  destination text NOT NULL,
  location text NOT NULL,
  status text DEFAULT 'Collected',
  expected_delivery timestamptz,
  items jsonb DEFAULT '[]'::jsonb,    -- array of { itemId, name, description, weight, quantity, cost }
  updates jsonb DEFAULT '[]'::jsonb,  -- array of { location, status, timestamp }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trackings_tracking_number ON trackings (tracking_number);
CREATE INDEX IF NOT EXISTS idx_trackings_status ON trackings (status);
CREATE INDEX IF NOT EXISTS idx_trackings_created_at ON trackings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trackings_location ON trackings (location);

-- Trigger to keep updated_at current
DROP TRIGGER IF EXISTS set_timestamp_trackings ON trackings;
CREATE TRIGGER set_timestamp_trackings
BEFORE UPDATE ON trackings
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
