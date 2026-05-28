#!/usr/bin/env node
/**
 * Direct Telegram API Test
 * Tests message sending via direct HTTPS calls (bypasses node-telegram-bot-api library issues)
 */

require('dotenv').config();
const https = require('https');
const querystring = require('querystring');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = parseInt(process.env.TELEGRAM_ADMIN_ID, 10);

async function sendTelegramMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const data = querystring.stringify({
      chat_id: chatId,
      text: text,
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (err) {
          reject(new Error(`Invalid JSON: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('📱 DIRECT TELEGRAM API TEST');
  console.log('='.repeat(70) + '\n');

  try {
    console.log('Sending messages via direct HTTPS API...\n');
    console.log(`Token: ${TOKEN.slice(0, 10)}...`);
    console.log(`Chat ID: ${ADMIN_CHAT_ID}\n`);

    // Test 1: Simple text message
    console.log('1️⃣  Simple text message');
    try {
      const msg1 = await sendTelegramMessage(ADMIN_CHAT_ID, '✅ Routes system Telegram messaging is working!');
      if (msg1.ok) {
        console.log(`   ✅ Sent! Message ID: ${msg1.result.message_id}\n`);
      } else {
        console.log(`   ❌ Failed: ${msg1.description}\n`);
        throw new Error(msg1.description);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      throw err;
    }

    // Test 2: Formatted message
    console.log('2️⃣  Formatted message with emoji');
    const msg2 = await sendTelegramMessage(ADMIN_CHAT_ID, 
      `🚀 System Status Report\n\n` +
      `Time: ${new Date().toISOString()}\n` +
      `Status: ✅ All systems operational\n\n` +
      `🔧 Services:\n` +
      `  • Supabase: Online\n` +
      `  • Telegram Bot: Online\n` +
      `  • Express API: Online`
    );
    if (msg2.ok) {
      console.log(`   ✅ Sent! Message ID: ${msg2.result.message_id}\n`);
    } else {
      console.log(`   ❌ Failed: ${msg2.description}\n`);
      throw new Error(msg2.description);
    }

    // Test 3: Message with timestamp (real-world use case)
    console.log('3️⃣  Real-world notification');
    const trackingNumber = 'TRK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const msg3 = await sendTelegramMessage(ADMIN_CHAT_ID, 
      `📦 New Shipment Tracked\n\n` +
      `Tracking #: ${trackingNumber}\n` +
      `Status: Collected\n` +
      `From: Test Warehouse\n` +
      `To: Test Location\n\n` +
      `Timestamp: ${new Date().toISOString()}`
    );
    if (msg3.ok) {
      console.log(`   ✅ Sent! Message ID: ${msg3.result.message_id}\n`);
    } else {
      console.log(`   ❌ Failed: ${msg3.description}\n`);
      throw new Error(msg3.description);
    }

    console.log('='.repeat(70));
    console.log('🎉 ALL TESTS PASSED');
    console.log('='.repeat(70));
    console.log('\n✅ Telegram messaging verified!\n');
    console.log('📲 Check your Telegram @Abbyberner0_03 - you should see 3 messages above.\n');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTest().then(() => process.exit(0));
