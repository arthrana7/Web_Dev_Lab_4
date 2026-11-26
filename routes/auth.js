const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const appEvents = require('../events/appEvents');

const router = express.Router();

/**
 * POST /api/auth/signup
 * Register a new user
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Validate presence of all fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim().toLowerCase();

    if (!trimmedUsername || !trimmedEmail) {
      return res.status(400).json({ message: 'Invalid username or email' });
    }

    // Password minimum 6 characters
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if email or username already exists (409 Conflict)
    const existingUser = await User.findOne({
      $or: [{ email: trimmedEmail }, { username: trimmedUsername }]
    });

    if (existingUser) {
      if (existingUser.email === trimmedEmail) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      return res.status(409).json({ message: 'Username already in use' });
    }

    // Hash password with bcrypt (10 salt rounds)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      password: hashedPassword,
      role: 'user'
    });

    // Emit event: user:registered
    appEvents.emit('user:registered', newUser.username);

    // EXACT response format
    return res.status(201).json({
      message: 'User registered',
      id: newUser._id.toString(),
      username: newUser.username,
      email: newUser.email
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and issue JWT + httpOnly cookie
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Sign JWT
    const payload = {
      id: user._id.toString(),
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });

    // Set httpOnly cookie named "token"
    res.setHeader(
      'Set-Cookie',
      `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600`
    );

    // Emit event: user:loggedIn
    appEvents.emit('user:loggedIn', user.username);

    // EXACT response format
    return res.status(200).json({
      message: 'Login successful',
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Clears the "token" cookie
 */
router.post('/logout', (req, res) => {
  res.setHeader(
    'Set-Cookie',
    'token=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
  );
  return res.status(200).json({ message: 'Logged out' });
});

module.exports = router;
