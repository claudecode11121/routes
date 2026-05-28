-- ============================================================================
-- MASTER MIGRATION: Rapid Routes Database Schema
-- ============================================================================
-- This file contains all SQL DDL to set up the Rapid Routes PostgreSQL schema.
-- Run this script in your Supabase SQL Editor to initialize the database.
-- 
-- Order of execution:
-- 1. Create pgcrypto extension
-- 2. Create trigger function (used by all tables)
-- 3. Create 4 main tables with indexes and triggers
--
-- No data is inserted; this is schema initialization only.
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable PostgreSQL Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- STEP 2: Create Universal Trigger Function
-- ============================================================================
-- This function is used by all tables to automatically update the updated_at
-- timestamp whenever a record is modified.
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE 1: temp_shipments
-- ============================================================================
-- Temporary shipment records created when a user fills out the shipment form.
-- Once approved by admin, data is transferred to the tracking table.
--
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

-- ============================================================================
-- TABLE 2: trackings
-- ============================================================================
-- Main tracking records for shipments in the system.
-- Contains full shipment details, status updates, and delivery information.
--
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

-- ============================================================================
-- TABLE 3: admins
-- ============================================================================
-- Administrator user accounts for the system.
-- Stores username and bcrypt-hashed password.
--
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for login queries
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins (username);

-- ============================================================================
-- TABLE 4: telegram_users
-- ============================================================================
-- Telegram user linking and session state management.
-- Tracks which Telegram users are linked to which shipments and their
-- current conversation state.
--
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

-- ============================================================================
-- SCHEMA INITIALIZATION COMPLETE
-- ============================================================================
-- All tables, indexes, and triggers have been created successfully.
--
-- Next Step: Enable Row Level Security (RLS) if needed
-- For now, the database is accessible via Supabase service role credentials.
--
-- To verify setup:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- ============================================================================
