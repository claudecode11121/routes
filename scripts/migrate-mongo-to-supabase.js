#!/usr/bin/env node
/**
 * MongoDB to Supabase Migration Script
 * 
 * USAGE:
 * 1. Export MongoDB collections to JSON:
 *    mongoexport --uri "mongodb+srv://..." --collection temp_shipments --out temp_shipments.json
 * 
 * 2. Place the JSON file(s) in the ./imports/ directory
 * 
 * 3. Run this script:
 *    node scripts/migrate-mongo-to-supabase.js
 * 
 * 4. The script will read JSON files and insert into Supabase
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const IMPORTS_DIR = path.join(__dirname, '../imports');

async function migrateCollection(collectionName, jsonPath) {
  console.log(`\n📂 Reading: ${jsonPath}`);

  let data;
  try {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    data = JSON.parse(rawData);
  } catch (err) {
    console.error(`❌ Failed to parse JSON: ${err.message}`);
    return { success: false, count: 0, error: err.message };
  }

  // Ensure data is an array
  if (!Array.isArray(data)) {
    data = [data];
  }

  console.log(`✅ Loaded ${data.length} records from ${collectionName}`);

  // Transform and insert
  let inserted = 0;
  let failed = 0;

  for (let record of data) {
    try {
      // Map MongoDB field names to Supabase column names
      const transformed = transformRecord(collectionName, record);

      const { error } = await supabase
        .from(collectionName)
        .insert([transformed]);

      if (error) {
        console.warn(`⚠️ Insert error for record ${record._id || record.tempId}: ${error.message}`);
        failed++;
      } else {
        inserted++;
        if (inserted % 10 === 0) {
          console.log(`  ... ${inserted} records inserted`);
        }
      }
    } catch (err) {
      console.error(`❌ Transform error:`, err.message);
      failed++;
    }
  }

  return { success: failed === 0, count: inserted, failed };
}

function transformRecord(collectionName, record) {
  if (collectionName === 'temp_shipments') {
    return {
      temp_id: record.tempId || record.temp_id,
      sender: record.sender || null,
      receiver: record.receiver || null,
      items: record.items || [],
      origin: record.origin || null,
      destination: record.destination || null,
      status: record.status || 'Pending Receiver Info',
      telegram_chat_id: record.telegramChatId || record.telegram_chat_id || null,
      created_at: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      updated_at: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  if (collectionName === 'trackings') {
    return {
      tracking_number: record.trackingNumber || null,
      sender: record.sender || null,
      receiver: record.receiver || null,
      origin: record.origin || null,
      destination: record.destination || null,
      location: record.location || null,
      status: record.status || 'Collected',
      expected_delivery: record.expectedDelivery ? new Date(record.expectedDelivery).toISOString() : null,
      items: record.items || [],
      updates: record.updates || [],
      created_at: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      updated_at: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  if (collectionName === 'admins') {
    return {
      username: record.username || null,
      password: record.password || null,
      created_at: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
    };
  }

  if (collectionName === 'telegram_users') {
    return {
      chat_id: record.chatId || null,
      username: record.username || 'User',
      temp_ids: record.tempIds || [],
      current_session: record.currentSession || { state: 'IDLE' },
      created_at: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      updated_at: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  // Fallback: return record as-is
  return record;
}

async function main() {
  console.log('🚀 Starting MongoDB → Supabase Migration');
  console.log(`📍 Looking for JSON files in: ${IMPORTS_DIR}`);

  // Create imports dir if missing
  if (!fs.existsSync(IMPORTS_DIR)) {
    fs.mkdirSync(IMPORTS_DIR, { recursive: true });
    console.log(`\n📁 Created directory: ${IMPORTS_DIR}`);
    console.log(`⚠️  Please place your exported JSON files there and run again.`);
    console.log(`\n   Example: mongoexport --uri "..." --collection temp_shipments --out ${IMPORTS_DIR}/temp_shipments.json`);
    process.exit(0);
  }

  const files = fs.readdirSync(IMPORTS_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('❌ No JSON files found in imports/ directory');
    process.exit(1);
  }

  const results = {};

  for (const file of files) {
    // Derive collection name from filename (e.g., temp_shipments.json → temp_shipments)
    const collectionName = path.basename(file, '.json');
    const fullPath = path.join(IMPORTS_DIR, file);

    results[collectionName] = await migrateCollection(collectionName, fullPath);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(50));

  for (const [collection, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '⚠️';
    console.log(`${status} ${collection}: ${result.count} inserted, ${result.failed} failed`);
  }

  console.log('='.repeat(50));
  console.log('✅ Migration complete!');
}

main().catch(err => {
  console.error('❌ FATAL ERROR:', err.message);
  process.exit(1);
});
