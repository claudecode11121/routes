const { supabase } = require('../lib/supabase');

const TABLE = 'telegram_users';

async function findByChatId(chatId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('chat_id', chatId)
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

/**
 * Find user by any of their linked tempIds
 */
async function findByTempId(tempId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .contains('temp_ids', [tempId])
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update user, linking a shipment
 */
async function createOrLinkUser(chatId, username, tempId) {
  if (!chatId || !tempId) {
    throw new Error('chatId and tempId are required');
  }

  // Check if user exists
  let user = await findByChatId(chatId);

  if (user) {
    // User exists: add tempId to array if not already present
    const currentTempIds = user.temp_ids || [];
    if (!currentTempIds.includes(tempId)) {
      currentTempIds.push(tempId);
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({ temp_ids: currentTempIds, updated_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Create new user
    const { data, error } = await supabase
      .from(TABLE)
      .insert([
        {
          chat_id: chatId,
          username: username || 'User',
          temp_ids: [tempId],
          current_session: { state: 'IDLE', tempId: null, lastInteraction: null, context: null },
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Get session state (check for stale sessions)
 */
async function getSessionState(chatId) {
  const user = await findByChatId(chatId);
  if (!user) return null;

  // Check if session is stale (older than 30 minutes)
  const session = user.current_session || {};
  if (session.lastInteraction) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (new Date(session.lastInteraction) < thirtyMinutesAgo) {
      // Session is stale, reset it
      await updateSessionState(chatId, 'IDLE', null, null);
      return { state: 'IDLE', tempId: null, lastInteraction: null, context: null };
    }
  }

  return session;
}

/**
 * Update session state
 */
async function updateSessionState(chatId, newState, tempId = null, context = null) {
  const user = await findByChatId(chatId);
  if (!user) return null;

  const newSession = {
    state: newState || 'IDLE',
    tempId: tempId !== undefined ? tempId : user.current_session?.tempId || null,
    lastInteraction: new Date().toISOString(),
    context: context !== undefined ? context : user.current_session?.context || null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      current_session: newSession,
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', chatId)
    .select()
    .single();

  if (error) throw error;
  return data.current_session;
}

/**
 * Delete user
 */
async function deleteById(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { message: 'User deleted' };
}

/**
 * Helper: check if session is stale (for bot logic)
 */
function isSessionStale(lastInteraction) {
  if (!lastInteraction) return true;
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  return new Date(lastInteraction) < thirtyMinutesAgo;
}

module.exports = {
  findByChatId,
  findById,
  findByTempId,
  createOrLinkUser,
  getSessionState,
  updateSessionState,
  deleteById,
  isSessionStale,
};
