const express = require('express');
const User = require('../models/User');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/admin/users
 * Protected + admin only; returns all users (without passwords)
 */
router.get('/users', verifyToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
