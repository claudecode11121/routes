// server/lib/email.js
require('dotenv').config();

const BREVO_KEY = process.env.BREVO_KEY;
const DEFAULT_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@rapidroute.com';
const DEFAULT_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Rapid Route Logistics';

async function sendBrevoEmail({ to, subject, html, senderEmail, senderName }) {
  if (!BREVO_KEY) {
    const err = new Error('BREVO_KEY not configured');
    err.code = 'NO_BREVO_KEY';
    throw err;
  }

  const payload = {
    sender: {
      email: senderEmail || DEFAULT_SENDER_EMAIL,
      name: senderName || DEFAULT_SENDER_NAME,
    },
    to: [{ email: to }],
    subject: subject,
    htmlContent: html,
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error('Brevo API error');
    err.status = res.status;
    err.response = data;
    throw err;
  }

  return data;
}

module.exports = { sendBrevoEmail };
