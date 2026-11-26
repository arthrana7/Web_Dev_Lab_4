require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/makeAdmin.js <email>');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in environment variables');
  process.exit(1);
}

async function makeAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const targetEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: targetEmail });

    if (!user) {
      console.error(`User with email "${targetEmail}" not found.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();

    console.log(`Success: User ${user.email} (${user.username}) is now an admin.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error updating user role:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

makeAdmin();
