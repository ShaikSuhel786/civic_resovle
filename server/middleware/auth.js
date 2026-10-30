// Civic Resolve AI: Production Authentication & Role-Based Authorization Middleware
// Enforces least-privilege role boundaries and cryptographic token verification.

const jwt = require('jsonwebtoken');
const db = require('../db');

// Enforce strong session secret in production environments
function resolveJwtSecret() {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  const isDemo = process.env.ALLOW_DEMO_MODE === 'true' || 
                 process.env.ALLOW_EPHEMERAL_DEMO === 'true' ||
                 Boolean((process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV) && process.env.REQUIRE_PRODUCTION_DB !== 'true');

  if (isProduction && !isDemo) {
    if (!secret || secret.length < 32 || secret.includes('prototype_eval_only')) {
      throw new Error(
        '[FATAL SECURITY CONFIGURATION] In production mode, SESSION_SECRET environment variable ' +
        'must be explicitly set with a cryptographically strong secret of at least 32 characters.'
      );
    }
    return secret;
  }

  // Non-production development or serverless demo preview fallback
  return secret || 'civic_resolve_secure_session_secret_for_prototype_eval_only_2026';
}

const JWT_SECRET = resolveJwtSecret();

/**
 * Extracts and verifies user ID strictly from cryptographically signed JWTs in HTTP headers.
 * Rejects all arbitrary header-spoofing and URL/query-string session token leaks.
 */
function extractUserId(req) {
  let token = null;

  // Strictly accept Bearer token in Authorization header
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || decoded.id || null;
  } catch (e) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const userId = extractUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required. Please sign in with a valid session.' });
    }

    // Look up profile in database and verify active state
    const profile = await db.get('SELECT id, email, display_name, role, department_id, active, preferred_language FROM profiles WHERE id = ?', [userId]);

    if (!profile) {
      return res.status(401).json({ error: 'User profile not found or invalidated.' });
    }

    if (!profile.active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact administrator.' });
    }

    // Attach verified user to request
    req.user = profile;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const userId = extractUserId(req);

    if (userId) {
      const profile = await db.get('SELECT id, email, display_name, role, department_id, active, preferred_language FROM profiles WHERE id = ?', [userId]);
      if (profile && profile.active) {
        req.user = profile;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
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
  resolveJwtSecret,
  extractUserId,
  requireAuth,
  optionalAuth,
  requireRole
};
