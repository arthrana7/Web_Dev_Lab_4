const jwt = require('jsonwebtoken');

/**
 * Manually parse Cookie header string into a key-value object.
 * Required: do NOT use cookie-parser.
 */
const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(val);
        } catch (e) {
          cookies[key] = val;
        }
      }
    }
  }
  return cookies;
};

/**
 * JWT Verification Middleware
 * Reads token from Authorization: Bearer <token> OR httpOnly cookie "token".
 */
const verifyToken = (req, res, next) => {
  let token = null;

  // 1. Check Authorization header
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (authHeader) {
    // Postman users sometimes paste "Bearer <token>" into the Bearer Token
    // field, which adds a second Bearer prefix. Strip repeated prefixes while
    // still requiring a Bearer authorization scheme.
    const match = authHeader.trim().match(/^(?:Bearer\s+)+(.+)$/i);
    if (match) {
      token = match[1].trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  }

  // 2. Fallback to cookie "token" (parsed manually)
  if (!token && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.token) {
      token = cookies.token;
    }
  }

  // 3. No token provided
  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  // 4. Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access to specified roles.
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  authorizeRoles,
  parseCookies
};
