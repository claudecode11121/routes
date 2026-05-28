require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const TelegramUser = require('./models/TelegramUser.supabase');
const TempShipment = require('./models/TempShipment.supabase');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = parseInt(process.env.TELEGRAM_ADMIN_ID, 10);

// ✅ Validate token before creating bot
if (!token) {
  console.warn("⚠️ WARNING: TELEGRAM_BOT_TOKEN not set in environment variables");
}

const bot = token ? new TelegramBot(token) : null;
if (bot) {
  console.log("🌐 Telegram bot initialized");
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
if (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || "";

    console.log(`📬 Message from ${chatId}: "${text.substring(0, 50)}..."`);

    try {
      // 1. Ignore /start commands as they are handled by bot.onText below
      if (text && text.startsWith('/start')) return;

      // 2. IF MESSAGE IS FROM A USER -> FORWARD TO ADMIN
      if (chatId !== adminId) {
        try {
          // Forward the original message so Admin can see context
          await bot.forwardMessage(adminId, chatId, msg.message_id);
          
          // Fallback: Send a small text block with the ID in case Admin needs to reply manually 
          // or if the user's privacy settings hide their "forward_from" info.
          await bot.sendMessage(adminId, `🆔 User ID: \`${chatId}\` (Reply to the message above to chat)`);
          
          // ✅ Mark session as awaiting admin response
          await updateSessionState(chatId, "AWAITING_ADMIN_RESPONSE", null, text);
        } catch (err) {
          console.error("❌ Forwarding to admin failed:", err.message);
          // Notify user that forwarding failed
          try {
            await bot.sendMessage(chatId, "⚠️ Failed to send your message to support. Please try again.");
          } catch (sendErr) {
            console.error("❌ Could not notify user of forwarding failure:", sendErr.message);
          }
        }
      }

      // 3. IF MESSAGE IS FROM ADMIN -> CHECK IF REPLIED TO A FORWARD
      else if (chatId === adminId && msg.reply_to_message) {
        let targetUserChatId;

        // Check if it's a direct forward
        if (msg.reply_to_message.forward_from) {
          targetUserChatId = msg.reply_to_message.forward_from.id;
        } 
        // If privacy settings hide 'forward_from', try to extract ID from our fallback text
        else if (msg.reply_to_message.text && msg.reply_to_message.text.includes('User ID:')) {
          const match = msg.reply_to_message.text.match(/User ID: \`?(\d+)\`?/);
          if (match) targetUserChatId = parseInt(match[1], 10);
        }

        if (targetUserChatId) {
          try {
            // ✅ Verify the user exists and is active before sending
            const session = await getSessionState(targetUserChatId);
            
            await bot.sendMessage(targetUserChatId, text);
            await bot.sendMessage(adminId, "✅ Reply sent to user.");
            
            // Update target user's session
            await updateSessionState(targetUserChatId, "IDLE");
          } catch (err) {
            console.error(`❌ Failed to send reply to ${targetUserChatId}:`, err.message);
            try {
              await bot.sendMessage(adminId, `❌ Failed to send: ${err.message}`);
            } catch (notifyErr) {
              console.error("❌ Could not notify admin of failure:", notifyErr.message);
            }
          }
        } else {
          // Admin needs to know the reply failed to extract a user ID
          try {
            await bot.sendMessage(adminId, "⚠️ Could not extract User ID from message. Please ensure you're replying to a forwarded customer message.");
          } catch (notifyErr) {
            console.error("❌ Could not notify admin:", notifyErr.message);
          }
          console.warn("⚠️ Admin reply failed: No valid targetUserChatId extracted from:", msg.reply_to_message);
        }
      }
    } catch (err) {
      // OUTER error handler for unexpected crashes
      console.error("❌ UNEXPECTED ERROR in message handler:", err.message, err.stack);
    }
  });
}

// =====================
// /start command
// =====================
if (bot) {
  bot.onText(/^\/start(?:\s+(.+))?/, async (msg, match) => {
    try {
      const chatId = msg.chat.id;
      const tempId = match[1]; 
      const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || "User";

      console.log("🚀 /start triggered:", { chatId, tempId });

      if (!tempId) {
        try {
          await bot.sendMessage(chatId, "👋 Welcome to Rapid Routes! Please use your specific shipment link to get started.");
        } catch (err) {
          console.error("❌ Failed to send welcome message:", err.message);
        }
        return;
      }

      // Link the user (creates DB entry)
      await linkUserFromApi(tempId, chatId, username);

    // ✅ Initialize session state
    await updateSessionState(chatId, "IDLE", tempId);

    try {
      await bot.sendMessage(chatId,
        `👋 Hi ${username}! We've successfully linked your Telegram.\n\n` +
        `Our team will reach out to you here regarding your parcel (Tracking ID: ${tempId}).`
      );
    } catch (err) {
      console.error("❌ Failed to send welcome message to user:", err.message);
    }

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

  } catch (err) {
    console.error("❌ /start error:", err.message);
    try {
      // ✅ NOW WITH AWAIT - Promise won't silently reject
      await bot.sendMessage(chatId, "❌ Failed to link your Tracking ID. Please try again or contact support.");
    } catch (sendErr) {
      console.error("❌ CRITICAL: Could not send error message to user:", sendErr.message);
    }
  }
  });
}

module.exports = {
  bot,
  linkUserFromApi,
  sendMessageToUser,
  updateSessionState,
  getSessionState,
};
