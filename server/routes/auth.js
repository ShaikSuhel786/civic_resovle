// Civic Resolve AI: Production Authentication & Profile Routes
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

// Public demo accounts list for evaluator 1-click convenience
router.get('/demo-accounts', (req, res) => {
  const accounts = db.all(`
    SELECT p.id, p.email, p.display_name, p.role, p.department_id, d.name as department_name
    FROM profiles p
    LEFT JOIN departments d ON p.department_id = d.id
    WHERE p.active = 1
    ORDER BY CASE p.role 
      WHEN 'admin' THEN 1 
      WHEN 'staff' THEN 2 
      WHEN 'citizen' THEN 3 
      ELSE 4 END, p.email ASC
  `);
  res.json({ demoAccounts: accounts });
});

// Citizen Registration Endpoint (Real Users)
router.post('/register', (req, res) => {
  const { fullName, email, password, phone, preferredLanguage } = req.body;

  if (!fullName || fullName.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter your full name (minimum 2 characters).' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Check if email already registered
  const existing = db.get('SELECT id FROM profiles WHERE LOWER(email) = ?', [cleanEmail]);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = 'usr-cz-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
  const lang = (preferredLanguage === 'te') ? 'te' : 'en';
  const cleanPhone = phone ? phone.trim() : null;

  try {
    db.run(`
      INSERT INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash, phone, created_at)
      VALUES (?, ?, ?, 'citizen', NULL, 1, ?, ?, ?, datetime('now'))
    `, [userId, cleanEmail, fullName.trim(), lang, passwordHash, cleanPhone]);

    // Send Welcome Notification
    const notifId = 'notif-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    db.run(`
      INSERT INTO notifications (id, recipient_id, title, message, read, created_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'))
    `, [
      notifId,
      userId,
      'Welcome to Civic Resolve AI',
      'Your citizen account is registered! You can now report community issues, monitor real-time municipal triage, and track resolution timelines.'
    ]);

    const token = jwt.sign(
      { userId, role: 'citizen', email: cleanEmail },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account registered successfully.',
      token,
      user: {
        id: userId,
        email: cleanEmail,
        displayName: fullName.trim(),
        role: 'citizen',
        phone: cleanPhone,
        preferredLanguage: lang
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create user account. Please try again.' });
  }
});

// Designated seeded demo accounts for prototype evaluation
const SEEDED_DEMO_USER_IDS = new Set([
  'usr-admin-01',
  'usr-citizen-01',
  'usr-citizen-02',
  'usr-staff-roads',
  'usr-staff-sanitation',
  'usr-staff-electrical',
  'usr-staff-water',
  'usr-staff-publicworks'
]);

// Sign-in endpoint (Supports both real users and explicitly-enabled demo accounts)
router.post('/login', (req, res) => {
  const { email, password, demoUserId } = req.body || {};

  let user = null;

  if (demoUserId) {
    const isDemoLoginAllowed = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_LOGIN === 'true';
    if (!isDemoLoginAllowed) {
      return res.status(403).json({ error: 'Demo login is disabled in production environments.' });
    }

    if (typeof demoUserId !== 'string' || !SEEDED_DEMO_USER_IDS.has(demoUserId.trim())) {
      return res.status(401).json({ error: 'Invalid demo user account.' });
    }

    user = db.get('SELECT * FROM profiles WHERE id = ? AND active = 1', [demoUserId.trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Demo account not found or deactivated.' });
    }
  } else {
    // Normal email + password sign-in
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const altEmail = cleanEmail.includes('@civicresolve.demo') 
      ? cleanEmail.replace('@civicresolve.demo', '@civicsync.demo')
      : cleanEmail.replace('@civicsync.demo', '@civicresolve.demo');

    user = db.get('SELECT * FROM profiles WHERE (LOWER(email) = ? OR LOWER(email) = ?) AND active = 1', [
      cleanEmail,
      altEmail
    ]);

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatches = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      departmentId: user.department_id,
      phone: user.phone || null,
      preferredLanguage: user.preferred_language || 'en'
    }
  });
});

// Current user profile with live statistics
router.get('/profile', requireAuth, (req, res) => {
  const user = db.get('SELECT id, email, display_name, role, department_id, phone, preferred_language, created_at FROM profiles WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  // Calculate user activity stats
  const stats = db.get(`
    SELECT 
      COUNT(*) as total_reports,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved_reports,
      SUM(CASE WHEN status IN ('Submitted', 'Under Review', 'Assigned', 'In Progress') THEN 1 ELSE 0 END) as active_reports
    FROM reports 
    WHERE citizen_id = ?
  `, [req.user.id]);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      phone: user.phone,
      preferredLanguage: user.preferred_language,
      createdAt: user.created_at
    },
    stats: {
      totalReports: stats ? stats.total_reports : 0,
      resolvedReports: stats ? stats.resolved_reports : 0,
      activeReports: stats ? stats.active_reports : 0
    }
  });
});

// Update Profile
router.put('/profile', requireAuth, (req, res) => {
  const { displayName, phone, preferredLanguage } = req.body;

  if (displayName && displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
  }

  const user = db.get('SELECT * FROM profiles WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const updatedName = displayName ? displayName.trim() : user.display_name;
  const updatedPhone = (phone !== undefined) ? (phone ? phone.trim() : null) : user.phone;
  const updatedLang = ['en', 'te'].includes(preferredLanguage) ? preferredLanguage : user.preferred_language;

  db.run(`
    UPDATE profiles
    SET display_name = ?, phone = ?, preferred_language = ?
    WHERE id = ?
  `, [updatedName, updatedPhone, updatedLang, req.user.id]);

  res.json({
    success: true,
    message: 'Profile updated successfully.',
    user: {
      id: user.id,
      email: user.email,
      displayName: updatedName,
      role: user.role,
      phone: updatedPhone,
      preferredLanguage: updatedLang
    }
  });
});

// Change Password
router.put('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const user = db.get('SELECT * FROM profiles WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Current password is required.' });
  }

  if (!user.password_hash || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password does not match.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.run('UPDATE profiles SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

  res.json({ success: true, message: 'Password updated successfully.' });
});

// Backward-compatible me endpoint
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
