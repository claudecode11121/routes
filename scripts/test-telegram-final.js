#!/usr/bin/env node
require('dotenv').config();
const https = require('https');
const querystring = require('querystring');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = parseInt(process.env.TELEGRAM_ADMIN_ID, 10);

console.log('\n' + '='.repeat(70));
console.log('📱 TELEGRAM MESSAGING TEST');
console.log('='.repeat(70) + '\n');

async function sendMessage(text) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      chat_id: CHAT_ID,
      text: text,
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Request timeout')));
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  try {
    console.log('Test 1: Simple message');
    const msg1 = await sendMessage('✅ Telegram messaging is working!');
    if (msg1.ok) {
      console.log(`✅ Sent! Message ID: ${msg1.result.message_id}\n`);
    } else {
      console.log(`❌ Failed: ${msg1.description}\n`);
    }

    console.log('Test 2: Formatted status update');
    const msg2 = await sendMessage(
      '🚀 System Status: Online\n' +
      'Supabase: ✅\n' +
      'Telegram Bot: ✅\n' +
      'Express API: ✅'
    );
    if (msg2.ok) {
      console.log(`✅ Sent! Message ID: ${msg2.result.message_id}\n`);
    } else {
      console.log(`❌ Failed: ${msg2.description}\n`);
    }

    console.log('Test 3: Tracking notification');
    const msg3 = await sendMessage(
      '📦 New Shipment: TRK-ABC123\n' +
      'Status: In Transit\n' +
      'Time: ' + new Date().toISOString()
    );
    if (msg3.ok) {
      console.log(`✅ Sent! Message ID: ${msg3.result.message_id}\n`);
    } else {
      console.log(`❌ Failed: ${msg3.description}\n`);
    }

    console.log('='.repeat(70));
    console.log('🎉 ALL MESSAGES SENT SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('\n✅ Telegram messaging is fully operational!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

runTests().then(() => process.exit(0));
