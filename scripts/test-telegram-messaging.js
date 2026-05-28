#!/usr/bin/env node
/**
 * Telegram Messaging Test
 * Tests direct message sending via Telegram bot
 */

require('dotenv').config();
const TelegramUser = require('../server/models/TelegramUser.supabase');
const { bot, sendMessageToUser } = require('../server/telegramBot');

const testChatId = 8429821940; // Your admin ID from .env - send to yourself for testing
const testTempId = `TEST-MSG-${Date.now()}`;

async function runMessagingTest() {
  console.log('\n' + '='.repeat(70));
  console.log('📱 TELEGRAM MESSAGING TEST');
  console.log('='.repeat(70) + '\n');

  try {
    // Step 1: Verify bot is initialized
    console.log('1️⃣  Checking Telegram bot...');
    if (!bot) {
      console.log('❌ Bot not initialized. TELEGRAM_BOT_TOKEN missing.');
      process.exit(1);
    }
    console.log('✅ Bot is initialized\n');

    // Step 2: Create/link a test user
    console.log('2️⃣  Linking test user to bot...');
    const user = await TelegramUser.createOrLinkUser(testChatId, 'test_user', testTempId);
    console.log(`✅ User linked: ${testChatId}`);
    console.log(`   Temp ID: ${testTempId}\n`);

    // Step 3: Send a test message
    console.log('3️⃣  Sending test message...');
    try {
      const result = await bot.sendMessage(
        testChatId,
        `🧪 Test Message from Routes System\n\nTime: ${new Date().toISOString()}\n\nIf you see this, Telegram messaging is working!`
      );
      console.log('✅ Message sent successfully!');
      console.log(`   Message ID: ${result.message_id}`);
      console.log(`   Chat ID: ${result.chat.id}\n`);
    } catch (err) {
      console.log(`❌ Failed to send message: ${err.message}`);
      console.log(`   Error Code: ${err.code || 'unknown'}`);
      console.log(`   Full Error:`, err);
      if (err.response) {
        console.log(`   Response Status: ${err.response.statusCode}`);
        console.log(`   Response Body:`, err.response.body);
      }
      console.log('\n');
      throw err;
    }

    // Step 4: Test sendMessageToUser function
    console.log('4️⃣  Testing sendMessageToUser function...');
    try {
      await sendMessageToUser(testTempId, '✨ This message was sent via sendMessageToUser function!');
      console.log('✅ sendMessageToUser function works\n');
    } catch (err) {
      console.log(`❌ sendMessageToUser failed: ${err.message}\n`);
    }

    console.log('='.repeat(70));
    console.log('🎉 TELEGRAM MESSAGING TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('\n✅ All messaging functions are working!');
    console.log('Check your Telegram for the test messages.\n');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runMessagingTest().then(() => process.exit(0));
