require('dotenv').config();
const path = require('path');
const tb = require('../telegramBot');

// Mock bot implementation
const mockBot = {
  async forwardMessage(adminId, chatId, messageId) {
    console.log(`[mockBot] forwardMessage -> admin:${adminId}, from:${chatId}, msgId:${messageId}`);
    return Promise.resolve();
  },
  async sendMessage(targetId, text) {
    console.log(`[mockBot] sendMessage -> ${targetId}: ${text}`);
    return Promise.resolve();
  },
  async copyMessage(targetId, fromId, messageId) {
    console.log(`[mockBot] copyMessage -> to:${targetId}, from:${fromId}, msgId:${messageId}`);
    return Promise.resolve();
  }
};

// Replace internal bot with mock
if (typeof tb.setBot === 'function') tb.setBot(mockBot);

// Prevent DB calls in session helpers by mocking them
tb.updateSessionState = async (chatId, state) => {
  console.log(`[mock] updateSessionState -> ${chatId}: ${state}`);
};
tb.getSessionState = async (chatId) => {
  console.log(`[mock] getSessionState -> ${chatId}`);
  return { state: 'IDLE' };
};
tb.linkUserFromApi = async (tempId, chatId, username) => {
  console.log(`[mock] linkUserFromApi -> tempId:${tempId}, chatId:${chatId}, username:${username}`);
  return { id: chatId, temp_id: tempId };
};

async function run() {
  console.log('--- Simulate: user sends message (should forward to admin) ---');
  const userMsg = {
    chat: { id: 123456789 },
    text: 'Hello, I need help with my parcel',
    message_id: 111
  };

  await tb.processIncomingMessage(userMsg);

  console.log('\n--- Simulate: admin replies by replying to forwarded message (with forward_from) ---');
  const adminReply = {
    chat: { id: parseInt(process.env.TELEGRAM_ADMIN_ID, 10) || 8429821940 },
    text: 'Hi — we have an update for you',
    message_id: 222,
    reply_to_message: { forward_from: { id: 123456789 }, message_id: 111 }
  };

  await tb.processIncomingMessage(adminReply);

  console.log('\n--- Simulate: admin replies to fallback text containing User ID ---');
  const adminReplyFallback = {
    chat: { id: parseInt(process.env.TELEGRAM_ADMIN_ID, 10) || 8429821940 },
    text: 'Fallback reply to user',
    message_id: 333,
    reply_to_message: { text: '🆔 User ID: `123456789` (Reply to the message above to chat)' }
  };

  await tb.processIncomingMessage(adminReplyFallback);

  console.log('\n--- Simulate: user sends /start command (should notify all admins) ---');
  const startMsg = {
    chat: { id: 987654321 },
    from: { username: 'TestUser123', first_name: 'Test' },
    text: '/start TMP-USER-LINKTEST-001',
    message_id: 444
  };

  await tb.processIncomingMessage(startMsg);

  console.log('\nSimulation complete');
}

run().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
