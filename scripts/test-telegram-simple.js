#!/usr/bin/env node
/**
 * Direct Telegram API Test - Simplified
 */

require('dotenv').config();
const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = parseInt(process.env.TELEGRAM_ADMIN_ID, 10);

console.log('Testing Telegram API...');
console.log(`Token: ${TOKEN.slice(0, 15)}...`);
console.log(`Chat ID: ${CHAT_ID}\n`);

const postData = `chat_id=${CHAT_ID}&text=Telegram%20messaging%20test%20from%20Routes%20System`;

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${TOKEN}/sendMessage`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.ok) {
        console.log('✅ Message sent successfully!');
        console.log(`Message ID: ${result.result.message_id}`);
        console.log(`Chat ID: ${result.result.chat.id}`);
      } else {
        console.log('❌ API error:', result.description);
      }
    } catch (err) {
      console.log('Parse error:', err.message);
      console.log('Response:', data);
    }
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
});

req.write(postData);
req.end();
