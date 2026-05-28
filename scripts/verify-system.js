#!/usr/bin/env node
/**
 * Integration Test Script: Supabase + Express API + Telegram Bot
 * 
 * Tests:
 * 1. DB CRUD: Create/read/update/delete tracking and telegram users
 * 2. Bot Logic: Test session updates and user linking
 * 3. API Logic: Simulate HTTP requests to API endpoints
 */

require('dotenv').config();
const crypto = require('crypto');

// Import helpers
const Tracking = require('../server/models/Tracking.supabase');
const TempShipment = require('../server/models/TempShipment.supabase');
const TelegramUser = require('../server/models/TelegramUser.supabase');
const Admin = require('../server/models/Admin.supabase');
const { bot, updateSessionState, linkUserFromApi } = require('../server/telegramBot');

// Test results tracking
const results = {
  supabaseConnect: { status: 'pending', error: null },
  trackingCreate: { status: 'pending', error: null, data: null },
  trackingRead: { status: 'pending', error: null },
  trackingUpdate: { status: 'pending', error: null },
  trackingDelete: { status: 'pending', error: null },
  telegramUserLink: { status: 'pending', error: null, data: null },
  telegramUserSession: { status: 'pending', error: null },
  telegramUserDelete: { status: 'pending', error: null },
  botLinkUser: { status: 'pending', error: null },
  botUpdateSession: { status: 'pending', error: null },
};

const testData = {
  trackingNumber: null,
  testChatId: 9999999,
  testTempId: `TEST-${crypto.randomUUID().slice(0, 8)}`,
};

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 INTEGRATION TEST: Supabase + Express API + Telegram Bot');
  console.log('='.repeat(70) + '\n');

  try {
    // ===== TEST 1: Supabase Connection =====
    console.log('📡 Test 1: Supabase Connection');
    try {
      const { supabase } = require('../server/lib/supabase');
      console.log('   ✅ Supabase client loaded');
      results.supabaseConnect.status = 'pass';
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
      results.supabaseConnect.status = 'fail';
      results.supabaseConnect.error = err.message;
      throw err;
    }

    // ===== TEST 2: Tracking CRUD =====
    console.log('\n📊 Test 2: Tracking CRUD Operations');

    // 2a. Create Tracking
    console.log('   2a. Creating tracking record...');
    try {
      const newTracking = await Tracking.create({
        sender: { name: 'Test Sender', email: 'sender@test.com', phone: '1234567890', address: '123 Main St' },
        receiver: { name: 'Test Receiver', email: 'receiver@test.com', phone: '0987654321', address: '456 Oak Ave' },
        origin: 'Test Warehouse',
        destination: 'Test Delivery Point',
        location: 'Warehouse',
        status: 'Collected',
        items: [{ itemId: 'ITEM-001', name: 'Test Package', description: 'Test item', weight: 5, quantity: 1, cost: 25 }],
      });
      if (!newTracking || !newTracking.tracking_number) throw new Error('No tracking number returned');
      testData.trackingNumber = newTracking.tracking_number;
      console.log(`      ✅ Created: ${testData.trackingNumber}`);
      results.trackingCreate.status = 'pass';
      results.trackingCreate.data = newTracking;
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.trackingCreate.status = 'fail';
      results.trackingCreate.error = err.message;
    }

    // 2b. Read Tracking
    console.log('   2b. Reading tracking record...');
    try {
      if (!testData.trackingNumber) throw new Error('No tracking number to read');
      const tracking = await Tracking.findByTrackingNumber(testData.trackingNumber);
      if (!tracking) throw new Error('Tracking not found');
      console.log(`      ✅ Retrieved: ${tracking.tracking_number} (Status: ${tracking.status})`);
      results.trackingRead.status = 'pass';
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.trackingRead.status = 'fail';
      results.trackingRead.error = err.message;
    }

    // 2c. Update Tracking Status
    console.log('   2c. Updating tracking status...');
    try {
      if (!testData.trackingNumber) throw new Error('No tracking number to update');
      const updated = await Tracking.updateStatus(testData.trackingNumber, 'In Transit', 'Distribution Center');
      if (!updated || updated.status !== 'In Transit') throw new Error('Status not updated');
      console.log(`      ✅ Updated: Status → ${updated.status}, Location → ${updated.location}`);
      results.trackingUpdate.status = 'pass';
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.trackingUpdate.status = 'fail';
      results.trackingUpdate.error = err.message;
    }

    // ===== TEST 3: Telegram User CRUD =====
    console.log('\n👤 Test 3: Telegram User Operations');

    // 3a. Link Telegram User
    console.log('   3a. Linking Telegram user...');
    try {
      const user = await TelegramUser.createOrLinkUser(testData.testChatId, '@testuser', testData.testTempId);
      if (!user || !user.chat_id) throw new Error('User not created');
      console.log(`      ✅ Linked: Chat ID ${user.chat_id}`);
      results.telegramUserLink.status = 'pass';
      results.telegramUserLink.data = user;
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.telegramUserLink.status = 'fail';
      results.telegramUserLink.error = err.message;
    }

    // 3b. Update Session State
    console.log('   3b. Updating session state...');
    try {
      const session = await TelegramUser.updateSessionState(testData.testChatId, 'AWAITING_INFO', testData.testTempId, 'test context');
      if (!session || session.state !== 'AWAITING_INFO') throw new Error('Session not updated');
      console.log(`      ✅ Updated: State → ${session.state}`);
      results.telegramUserSession.status = 'pass';
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.telegramUserSession.status = 'fail';
      results.telegramUserSession.error = err.message;
    }

    // ===== TEST 4: Bot Logic =====
    console.log('\n🤖 Test 4: Telegram Bot Logic');

    // 4a. linkUserFromApi function
    console.log('   4a. Testing linkUserFromApi...');
    try {
      const botUser = await linkUserFromApi(testData.testTempId + '-bot', testData.testChatId + 1, '@bottest');
      if (!botUser || !botUser.chat_id) throw new Error('User not linked via bot function');
      console.log(`      ✅ linkUserFromApi succeeded`);
      results.botLinkUser.status = 'pass';
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.botLinkUser.status = 'fail';
      results.botLinkUser.error = err.message;
    }

    // 4b. updateSessionState function
    console.log('   4b. Testing updateSessionState...');
    try {
      const sessionResult = await updateSessionState(testData.testChatId + 1, 'IDLE', null, null);
      if (!sessionResult) throw new Error('Session update function failed');
      console.log(`      ✅ updateSessionState succeeded: State → ${sessionResult.state}`);
      results.botUpdateSession.status = 'pass';
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.botUpdateSession.status = 'fail';
      results.botUpdateSession.error = err.message;
    }

    // ===== TEST 5: API Route Simulation =====
    console.log('\n🌐 Test 5: API Route Simulation');
    try {
      console.log('   5. Simulating GET /api/tracking/:trackingNumber...');
      if (!testData.trackingNumber) throw new Error('No tracking number to test');
      
      const tracking = await Tracking.findByTrackingNumber(testData.trackingNumber);
      if (!tracking) throw new Error('API would return 404');
      
      console.log(`      ✅ API simulation passed: Retrieved tracking ${tracking.tracking_number}`);
      console.log(`         - Status: ${tracking.status}`);
      console.log(`         - Location: ${tracking.location}`);
      console.log(`         - Items: ${tracking.items?.length || 0}`);
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
    }

    // ===== CLEANUP =====
    console.log('\n🧹 Cleanup: Removing Test Data');

    // Delete tracking
    if (testData.trackingNumber) {
      try {
        const temp = await Tracking.findByTrackingNumber(testData.trackingNumber);
        if (temp && temp.id) {
          await Tracking.deleteById(temp.id);
          console.log(`   ✅ Deleted test tracking: ${testData.trackingNumber}`);
          results.trackingDelete.status = 'pass';
        }
      } catch (err) {
        console.log(`   ⚠️  Could not delete tracking: ${err.message}`);
        results.trackingDelete.status = 'fail';
        results.trackingDelete.error = err.message;
      }
    }

    // Delete telegram users
    try {
      const user1 = await TelegramUser.findByChatId(testData.testChatId);
      if (user1 && user1.id) await TelegramUser.deleteById(user1.id);
      const user2 = await TelegramUser.findByChatId(testData.testChatId + 1);
      if (user2 && user2.id) await TelegramUser.deleteById(user2.id);
      console.log(`   ✅ Deleted test telegram users`);
      results.telegramUserDelete.status = 'pass';
    } catch (err) {
      console.log(`   ⚠️  Could not delete telegram users: ${err.message}`);
      results.telegramUserDelete.status = 'fail';
      results.telegramUserDelete.error = err.message;
    }
  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err.message);
  }

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(70));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(70));

  const passes = Object.values(results).filter(r => r.status === 'pass').length;
  const fails = Object.values(results).filter(r => r.status === 'fail').length;
  const pending = Object.values(results).filter(r => r.status === 'pending').length;

  Object.entries(results).forEach(([name, result]) => {
    const symbol = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏳';
    const errorMsg = result.error ? ` — ${result.error}` : '';
    console.log(`${symbol} ${name.padEnd(30)} ${result.status.toUpperCase()}${errorMsg}`);
  });

  console.log('\n' + '-'.repeat(70));
  console.log(`Total: ${passes} passed, ${fails} failed, ${pending} pending`);
  console.log('-'.repeat(70));

  if (fails === 0 && pending === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is ready for deployment.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed or are pending. Review above for details.\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});
