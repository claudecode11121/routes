# MongoDB → Supabase Migration Guide

This guide walks you through migrating your Express server from MongoDB/Mongoose to Supabase (PostgreSQL).

## Step 1: Add Supabase Credentials to `.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Finding your credentials:**
1. Go to your Supabase project dashboard
2. Click **Settings** → **API**
3. Copy the **URL** and **Service Role Key** (not the anon key)

## Step 2: Create Tables in Supabase

Run the SQL scripts in your Supabase SQL editor:

### Create the pgcrypto extension (one-time):
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Then run the table creation scripts:
- [server/migrations/001_create_temp_shipments.sql](server/migrations/001_create_temp_shipments.sql) ← See SQL schema in this file
- [server/migrations/001_create_trackings.sql](server/migrations/001_create_trackings.sql)

## Step 3: Export Data from MongoDB

For each collection you want to migrate:

```bash
# Export temp_shipments
mongoexport \
  --uri "mongodb+srv://username:password@cluster.mongodb.net/dbname" \
  --collection temp_shipments \
  --out imports/temp_shipments.json

# Export trackings
mongoexport \
  --uri "mongodb+srv://username:password@cluster.mongodb.net/dbname" \
  --collection trackings \
  --out imports/trackings.json

# Export admins
mongoexport \
  --uri "mongodb+srv://username:password@cluster.mongodb.net/dbname" \
  --collection admins \
  --out imports/admins.json

# Export telegram_users
mongoexport \
  --uri "mongodb+srv://username:password@cluster.mongodb.net/dbname" \
  --collection telegram_users \
  --out imports/telegram_users.json
```

## Step 4: Run the Migration Script

```bash
cd /path/to/rapid
npm install      # Ensure dependencies are installed
node scripts/migrate-mongo-to-supabase.js
```

The script will:
1. Read JSON files from the `imports/` folder
2. Transform MongoDB field names to PostgreSQL column names
3. Insert records into Supabase tables
4. Print a summary of inserted records

## Step 5: Update Code to Use Supabase Models

Replace Mongoose imports with Supabase helpers:

```javascript
// ❌ OLD (MongoDB/Mongoose)
const TempShipment = require("./models/TempShipment");
const Tracking = require("./models/Tracking");

// ✅ NEW (Supabase)
const TempShipment = require("./models/TempShipment.supabase");
const Tracking = require("./models/Tracking.supabase");
```

## API Comparison

### TempShipment

| Operation | Mongoose | Supabase |
|-----------|----------|----------|
| Find by tempId | `TempShipment.findOne({ tempId })` | `TempShipment.findByTempId(tempId)` |
| Find by ID | `TempShipment.findById(id)` | `TempShipment.findById(id)` |
| List all | `TempShipment.find()` | `TempShipment.listAll()` |
| Create | `TempShipment.create(data)` | `TempShipment.createShipment(data)` |
| Update by ID | `TempShipment.findByIdAndUpdate()` | `TempShipment.updateById(id, patch)` |
| Delete | `TempShipment.findByIdAndDelete(id)` | `TempShipment.deleteById(id)` |

### Tracking

| Operation | Mongoose | Supabase |
|-----------|----------|----------|
| Find by tracking number | `Tracking.findOne({ trackingNumber })` | `Tracking.findByTrackingNumber(number)` |
| Find by ID | `Tracking.findById(id)` | `Tracking.findById(id)` |
| List all (sorted) | `Tracking.find().sort()` | `Tracking.listAll({ order: 'desc' })` |
| Create | `Tracking.create(data)` | `Tracking.create(data)` |
| Update & add to updates array | `findOneAndUpdate({ $push })` | `Tracking.updateStatus(number, status, location)` |
| Update expected delivery | Manual update | `Tracking.updateExpectedDelivery(number, date)` |
| Delete | `Tracking.findByIdAndDelete(id)` | `Tracking.deleteById(id)` |

## Schema Mapping

### temp_shipments

```postgresql
id                  UUID (generated)
temp_id            TEXT (unique)
sender             JSONB
receiver           JSONB
items              JSONB (array)
origin             TEXT
destination        TEXT
status             TEXT (default: 'Pending Receiver Info')
telegram_chat_id   TEXT
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ
```

### trackings

```postgresql
id                 UUID (generated)
tracking_number    TEXT (unique)
sender             JSONB
receiver           JSONB
origin             TEXT (required)
destination        TEXT (required)
location           TEXT (required)
status             TEXT (default: 'Collected')
expected_delivery  TIMESTAMPTZ
items              JSONB (array)
updates            JSONB (array)
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ
```

## Troubleshooting

### Migration fails with "Relation does not exist"
- Ensure you've run the SQL table creation scripts in Supabase

### SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY errors
- Check your `.env` file has both variables set
- The Service Role Key (not the anon key) must be used server-side

### Some records insert but others fail
- Check the error message in the migration output
- Verify the JSON structure matches what the migration script expects

## Remaining Models to Migrate

- [ ] **Admin** - Simple (username, hashed password)
- [ ] **TelegramUser** - Medium complexity (chat_id, session state)

SQL schemas and helper files for these will be provided as part of the next phase.

## Files Created

- `server/lib/supabase.js` - Supabase client wrapper
- `server/models/TempShipment.supabase.js` - TempShipment data-access helpers
- `server/models/Tracking.supabase.js` - Tracking data-access helpers
- `scripts/migrate-mongo-to-supabase.js` - Data migration script
- `server/migrations/001_create_temp_shipments.sql` - SQL DDL
- `server/migrations/001_create_trackings.sql` - SQL DDL

## Next Steps

1. Migrate remaining models (Admin, TelegramUser)
2. Update `server/telegramBot.js` to use Supabase
3. Update remaining routes in `server/routes/` to use Supabase
4. Run integration tests
5. Decommission MongoDB
