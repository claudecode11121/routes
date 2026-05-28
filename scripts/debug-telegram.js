#!/usr/bin/env node
require('dotenv').config();
const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = parseInt(process.env.TELEGRAM_ADMIN_ID, 10);
const TEXT = 'Test message from Routes system';

const postData = `chat_id=${CHAT_ID}&text=${encodeURIComponent(TEXT)}`;

console.log('Telegram Direct Message Test\n');
console.log(`Using token: ${TOKEN.slice(0, 10)}...`);
console.log(`Chat ID: ${CHAT_ID}`);
console.log(`Making HTTPS request...\n`);

const req = https.request({
  hostname: 'api.telegram.org',
  port: 443,
  path: `/bot${TOKEN}/sendMessage`,
  method: 'POST',
  timeout: 10000,
  headers: {
    'Content-Length': Buffer.byteLength(postData),
  },
}, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}`);
    console.log(`Response Body:\n${body}\n`);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.code || 'UNKNOWN'}`);
  console.error(`Message: ${e.message}`);
  console.error(`Stack:`, e.stack);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('REQUEST TIMEOUT');
  req.destroy();
  process.exit(1);
});

console.log('Sending POST data...');
req.write(postData);
req.end();

console.log('Waiting for response...\n');
