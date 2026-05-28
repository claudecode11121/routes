const { supabase } = require('../lib/supabase');

const TABLE = 'admins';

async function findByUsername(username) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('username', username)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
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

async function create({ username, password }) {
  if (!username || !password) {
    throw new Error('username and password are required');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ username, password }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updatePassword(id, hashedPassword) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ password: hashedPassword })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteById(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { message: 'Admin deleted' };
}

module.exports = {
  findByUsername,
  findById,
  create,
  updatePassword,
  deleteById,
};
