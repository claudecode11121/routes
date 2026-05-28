const { supabase } = require('../lib/supabase');

const TABLE = 'temp_shipments';

async function findByTempId(tempId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('temp_id', tempId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // rethrow unless "no rows"
  return data;
}

async function findById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function listAll({ limit = 100, order = 'desc' } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: order === 'asc' })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function createShipment(payload) {
  // Normalize fields: sender, receiver, items must be JSON
  const body = {
    temp_id: payload.tempId || payload.temp_id,
    sender: payload.sender || null,
    receiver: payload.receiver || null,
    items: payload.items || [],
    origin: payload.origin || null,
    destination: payload.destination || null,
    status: payload.status || 'Pending Receiver Info',
    telegram_chat_id: payload.telegramChatId || payload.telegram_chat_id || null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert([body])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateById(id, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateByTempId(tempId, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('temp_id', tempId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
  return data;
}

module.exports = {
  findByTempId,
  findById,
  listAll,
  createShipment,
  updateById,
  updateByTempId,
  deleteById,
};
