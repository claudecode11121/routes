const { supabase } = require('../lib/supabase');
const crypto = require('crypto');

const TABLE = 'trackings';

function normalizeTrackingRow(row) {
  if (!row) return row;

  return {
    ...row,
    trackingNumber: row.trackingNumber || row.tracking_number || null,
    expectedDelivery: row.expectedDelivery || row.expected_delivery || null,
    createdAt: row.createdAt || row.created_at || null,
  };
}

function normalizeTrackingRows(rows) {
  if (!rows) return rows;
  return Array.isArray(rows) ? rows.map(normalizeTrackingRow) : normalizeTrackingRow(rows);
}

function generateTrackingNumber() {
  const num = Math.floor(100000000 + Math.random() * 900000000);
  return `CRJ-${num}`;
}

async function findByTrackingNumber(trackingNumber) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('tracking_number', trackingNumber)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return normalizeTrackingRow(data);
}

async function findById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return normalizeTrackingRow(data);
}

async function listAll({ limit = 100, order = 'desc' } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: order === 'asc' })
    .limit(limit);
  if (error) throw error;
  return normalizeTrackingRows(data);
}

async function create(payload) {
  // Generate tracking number if not provided
  const trackingNumber = payload.trackingNumber || payload.tracking_number || generateTrackingNumber();

  // Normalize field names and ensure defaults
  const body = {
    tracking_number: trackingNumber,
    sender: payload.sender || null,
    receiver: payload.receiver || null,
    origin: payload.origin || 'Unknown',
    destination: payload.destination || 'Unknown',
    location: payload.location || 'Warehouse',
    status: payload.status || 'Collected',
    expected_delivery: payload.expectedDelivery || payload.expected_delivery || null,
    items: payload.items || [],
    updates: payload.updates || [
      {
        status: payload.status || 'Created',
        location: payload.location || 'Warehouse',
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert([body])
    .select()
    .single();

  if (error) throw error;
  return normalizeTrackingRow(data);
}

async function updateById(id, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeTrackingRow(data);
}

async function updateByTrackingNumber(trackingNumber, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('tracking_number', trackingNumber)
    .select()
    .single();
  if (error) throw error;
  return normalizeTrackingRow(data);
}

/**
 * Update status and location, automatically appending to updates array
 */
async function updateStatus(trackingNumber, status, location) {
  // Get current record to append to updates
  const current = await findByTrackingNumber(trackingNumber);
  if (!current) throw new Error(`Tracking ${trackingNumber} not found`);

  const newUpdate = {
    status,
    location,
    timestamp: new Date().toISOString(),
  };

  const updatedUpdates = [...(current.updates || []), newUpdate];

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status,
      location,
      updates: updatedUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('tracking_number', trackingNumber)
    .select()
    .single();

  if (error) throw error;
  return normalizeTrackingRow(data);
}

/**
 * Update expected delivery date
 */
async function updateExpectedDelivery(trackingNumber, expectedDelivery) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ expected_delivery: expectedDelivery, updated_at: new Date().toISOString() })
    .eq('tracking_number', trackingNumber)
    .select()
    .single();
  if (error) throw error;
  return normalizeTrackingRow(data);
}

async function deleteById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
  return data;
}

async function deleteByTrackingNumber(trackingNumber) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('tracking_number', trackingNumber);
  if (error) throw error;
  return data;
}

module.exports = {
  findByTrackingNumber,
  findById,
  listAll,
  create,
  updateById,
  updateByTrackingNumber,
  updateStatus,
  updateExpectedDelivery,
  deleteById,
  deleteByTrackingNumber,
  generateTrackingNumber,
};
