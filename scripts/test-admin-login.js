#!/usr/bin/env node
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../server/models/Admin.supabase');

const USERNAME = 'admin';
const PASSWORD = '12345';

(async () => {
  try {
    console.log('Testing admin login for user:', USERNAME);
    const admin = await Admin.findByUsername(USERNAME);
    if (!admin) {
      console.error('Admin user not found');
      process.exit(2);
    }

    const ok = await bcrypt.compare(PASSWORD, admin.password);
    if (!ok) {
      console.error('Password mismatch');
      process.exit(3);
    }

    const SECRET = process.env.SECRET || 'dev_secret';
    const token = jwt.sign({ id: admin.id }, SECRET, { expiresIn: '1h' });

    console.log('Login successful. Admin ID:', admin.id);
    console.log('JWT (first 20 chars):', token.slice(0, 20) + '...');

    // Verify token
    const decoded = jwt.verify(token, SECRET);
    console.log('Decoded token payload:', decoded);

    process.exit(0);
  } catch (err) {
    console.error('Error during admin login test:', err.message || err);
    process.exit(1);
  }
})();
