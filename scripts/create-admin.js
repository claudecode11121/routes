#!/usr/bin/env node
require('dotenv').config();
const bcrypt = require('bcrypt');
const Admin = require('../server/models/Admin.supabase');

const USERNAME = 'admin';
const PASSWORD = '12345';

(async () => {
  try {
    console.log('Creating/updating admin user:', USERNAME);
    const existing = await Admin.findByUsername(USERNAME);
    const hashed = await bcrypt.hash(PASSWORD, 10);
    if (existing) {
      const updated = await Admin.updatePassword(existing.id, hashed);
      console.log('Updated existing admin password for id:', updated.id);
    } else {
      const created = await Admin.create({ username: USERNAME, password: hashed });
      console.log('Created admin with id:', created.id);
    }
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create/update admin:', err.message || err);
    process.exit(1);
  }
})();
