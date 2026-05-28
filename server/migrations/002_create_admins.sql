-- Admin table (PostgreSQL)
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for login queries
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins (username);
