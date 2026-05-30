require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const TelegramUser = require('./models/TelegramUser.supabase');
const TempShipment = require('./models/TempShipment.supabase');
const { sendBrevoEmail } = require('./lib/email');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = parseInt(process.env.TELEGRAM_ADMIN_ID, 10);

// ✅ Validate token before creating bot
if (!token) {
  console.warn("⚠️ WARNING: TELEGRAM_BOT_TOKEN not set in environment variables");
}

let bot = token ? new TelegramBot(token) : null;
if (bot) {
  console.log("🌐 Telegram bot initialized");
}

// Allow tests to replace the bot with a mock
function setBot(newBot) {
  bot = newBot;
}

// =====================
// DATABASE CONFIGURATION
// =====================
// Supabase connection is handled by the data-access helpers
// in server/lib/supabase.js

// =====================
// DB Helper for linking users
// =====================
async function linkUserFromApi(tempId, chatId, username) {
  if (!tempId || !chatId) throw new Error("tempId and chatId required");

  try {
    const user = await TelegramUser.createOrLinkUser(chatId, username, tempId);
    console.log(`✅ TelegramUser linked: ${tempId} → ${chatId}`);

    // Mark the session as active as soon as the link is created.
    await updateSessionState(chatId, "IDLE", tempId);

    // Send the customer a proactive welcome message with proper error handling.
    if (bot) {
      try {
        await bot.sendMessage(
          chatId,
          `Hello ${username}! Your shipment request (${tempId}) has been received. You can reply directly to this message to chat with our support team regarding your parcel.`
        );
        console.log('📨 Proactive welcome successfully sent to', chatId);
      } catch (err) {
        console.error("❌ Failed to send proactive welcome message:", err);
        // Fallback: notify admin by email that welcome to user failed
        try {
          await sendBrevoEmail({
            to: process.env.BREVO_SENDER_EMAIL,
            subject: `Telegram welcome failed for ${tempId}`,
            html: `<p>Failed to send proactive welcome to <strong>${chatId}</strong> for tempId <strong>${tempId}</strong>.</p><pre>${JSON.stringify(err, Object.getOwnPropertyNames(err))}</pre>`
          });
          console.log('✉️ Fallback email sent to admin about welcome failure');
        } catch (emailErr) {
          console.error('❌ Failed to send fallback email about welcome failure:', emailErr);
        }
      }
    }

    return user;
  } catch (err) {
    console.error("❌ Database error in linkUserFromApi:", err.message);
    throw new Error("Database unavailable. Please try again.");
  }
}

// =====================
// Send message to user by tempId (With Error Handling)
// =====================
async function sendMessageToUser(tempId, message) {
  try {
    const user = await TelegramUser.findByTempId(tempId);
    if (!user || !user.chat_id) {
      throw new Error(`User not linked to Telegram for Temp ID: ${tempId}`);
    }
    
    return bot.sendMessage(user.chat_id, message);
  } catch (err) {
    console.error("❌ Failed to send message:", err.message);
    throw err;
  }
}

// =====================
// Update Session State (Stateless-Safe)
// =====================
async function updateSessionState(chatId, newState, tempId = null, context = null) {
  try {
    await TelegramUser.updateSessionState(chatId, newState, tempId, context);
    console.log(`📝 Session updated: ${chatId} → ${newState}`);
    return { state: newState, tempId, lastInteraction: new Date().toISOString(), context };
  } catch (err) {
    console.error("❌ Failed to update session (DB unavailable):", err.message);
    return null; // Graceful degradation
  }
}

// =====================
// Get Session State (Stateless-Safe)
// =====================
async function getSessionState(chatId) {
  try {
    const session = await TelegramUser.getSessionState(chatId);
    return session;
  } catch (err) {
    console.error("❌ Failed to retrieve session (DB unavailable):", err.message);
    return null;
  }
}

// =====================
// Message Handling (Forwarding & Replying)
// =====================
// Core message processing function (extracted for testing and webhook execution)
async function processIncomingMessage(msg) {
  if (!msg || !msg.chat) {
    console.warn("⚠️ Ignoring malformed Telegram message:", JSON.stringify(msg));
    return;
  }

  const chatId = msg.chat.id;
  const text = msg.text || "";

  console.log(`📬 Message from ${chatId}: "${(text || '').toString().substring(0, 50)}..."`);

  try {
    if (text && text.startsWith('/start')) {
      const match = text.match(/^\/start(?:\s+(.+))?/);
      const tempId = match ? match[1] : null;
      const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "User";

      console.log("🚀 /start triggered:", { chatId, tempId });

      if (!tempId) {
        try {
          await bot.sendMessage(chatId, "👋 Welcome to Rapid Routes! Please use your specific shipment link to get started.");
        } catch (err) {
          console.error("❌ Failed to send welcome message:", err.message);
        }
        return;
      }

      await linkUserFromApi(tempId, chatId, username);

      try {
        await bot.sendMessage(adminId,
          `🔗 User Linked via Telegram
━━━━━━━━━━━━━━━
🆔 Temp ID: ${tempId}
👤 Username: ${username}
💬 Chat ID: ${chatId}`
        );
      } catch (err) {
        console.error("❌ Failed to notify admin of new user:", err.message);
      }
      return;
    }

    if (chatId !== adminId) {
      try {
        await bot.forwardMessage(adminId, chatId, msg.message_id);
        console.log('✅ User message successfully forwarded to admin');
        await bot.sendMessage(adminId, `🆔 User ID: \`${chatId}\` (Reply to the message above to chat)`);
        await updateSessionState(chatId, "AWAITING_ADMIN_RESPONSE", null, text);
      } catch (err) {
        console.error("❌ Forwarding to admin failed:", err);
        try {
          await sendBrevoEmail({
            to: process.env.BREVO_SENDER_EMAIL,
            subject: `Failed Telegram forward from ${chatId}`,
            html: `<p>Failed to forward message from <strong>${chatId}</strong> to admin.</p><pre>${JSON.stringify(msg, null, 2)}</pre>`
          });
          console.log('✉️ Fallback email sent to admin about forwarding failure');
        } catch (emailErr) {
          console.error('❌ Failed to send fallback email about forwarding failure:', emailErr);
        }

        try {
          await bot.sendMessage(chatId, "⚠️ Failed to send your message to support. Please try again.");
        } catch (sendErr) {
          console.error("❌ Could not notify user of forwarding failure:", sendErr);
        }
      }
    } else if (chatId === adminId && msg.reply_to_message) {
      let targetUserChatId;

      if (msg.reply_to_message.forward_from) {
        targetUserChatId = msg.reply_to_message.forward_from.id;
      } else if (msg.reply_to_message.text && msg.reply_to_message.text.includes('User ID:')) {
        const match = msg.reply_to_message.text.match(/User ID: \`?(\d+)\`?/);
        if (match) targetUserChatId = parseInt(match[1], 10);
      }

      if (targetUserChatId) {
        try {
          await getSessionState(targetUserChatId);
          await bot.sendMessage(targetUserChatId, text);
          await bot.sendMessage(adminId, "✅ Reply sent to user.");
          await updateSessionState(targetUserChatId, "IDLE");
        } catch (err) {
          console.error(`❌ Failed to send reply to ${targetUserChatId}:`, err);
          try {
            await bot.sendMessage(adminId, `❌ Failed to send: ${err.message || err}`);
          } catch (notifyErr) {
            console.error("❌ Could not notify admin of failure:", notifyErr);
          }
        }
      } else {
        try {
          await bot.sendMessage(adminId, "⚠️ Could not extract User ID from message. Please ensure you're replying to a forwarded customer message.");
        } catch (notifyErr) {
          console.error("❌ Could not notify admin:", notifyErr);
        }
        console.warn("⚠️ Admin reply failed: No valid targetUserChatId extracted from:", msg.reply_to_message);
      }
    }
  } catch (err) {
    console.error("❌ UNEXPECTED ERROR in message handler:", err.message, err.stack);
  }
}

module.exports = {
  bot,
  setBot,
  processIncomingMessage,
  linkUserFromApi,
  sendMessageToUser,
  updateSessionState,
  getSessionState,
};
