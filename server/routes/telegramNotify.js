const express = require("express");
const router = express.Router();
const { bot } = require("../telegramBot");

// Parse comma-separated admin IDs into an array of integers
const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

router.post("/telegram", async (req, res) => {
  try {
    console.log("📨 /telegram route called to notify Admin...");

    const { tempId, name, email, phone, address } = req.body;

    if (!tempId || !name) {
      console.log("❌ Missing tempId or name in request body");
      return res.status(400).json({ error: "Missing tempId or name" });
    }

    // -------------------- Alert the Admin --------------------
    const msgToAdmin = `📦 New Receiver Submission

━━━━━━━━━━━━━━━
👤 Name: ${name}
📧 Email: ${email || "N/A"}
📞 Phone: ${phone || "N/A"}
🏠 Address: ${address || "N/A"}
🆔 Temp ID: ${tempId}`;

    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, msgToAdmin);
      } catch (err) {
        console.error(`❌ Failed to send message to admin ${adminId}:`, err.message);
      }
    }
    console.log("✅ Message successfully sent to all admins");

    // Note: We no longer try to message the receiver here. 
    // They will get their welcome message automatically via telegramBot.js 
    // when they click the Telegram link and hit /start.

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Telegram Notify Error:", err);
    res.status(500).json({ error: "Failed to send Telegram message" });
  }
});

module.exports = router;
