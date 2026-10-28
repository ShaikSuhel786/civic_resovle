// Civic Resolve AI: Server-side Authentication & Role-Based Authorization Middleware
// Enforces FR-01, Section 3.2: Never trust client role claims; check active state.

const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.SESSION_SECRET || 'civic_resolve_secure_session_secret_for_prototype_eval_only_2026';

function requireAuth(req, res, next) {
  let userId = null;

  // 1. Check Bearer token strictly
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Invalid authorization header format.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    userId = decoded.userId;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  // Look up profile in database and verify active state
  const profile = db.get('SELECT id, email, display_name, role, department_id, active, preferred_language FROM profiles WHERE id = ?', [userId]);

  if (!profile) {
    return res.status(401).json({ error: 'User profile not found.' });
  }

  if (!profile.active) {
    return res.status(403).json({ error: 'Account is deactivated. Contact administrator.' });
  }

  // Attach verified user to request
  req.user = profile;
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Requires role: ${roles.join(' or ')}. Your verified role is '${req.user.role}'.` 
      });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  requireAuth,
  requireRole
};
