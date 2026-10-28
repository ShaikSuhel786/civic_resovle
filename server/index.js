// Civic Resolve AI: Express Server Entrypoint
// Hackathon Prototype Server implementing Vercel Serverless & Local Node execution.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3050;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Restore original client request path if altered by Vercel rewrites
app.use((req, res, next) => {
  const matched = req.headers['x-matched-path'];
  if (matched) {
    if (req.url.startsWith('/api/index') || req.url === '/api' || req.url === '/api/' || req.url.includes('[...path]') || (!req.url.startsWith('/api/') && matched.startsWith('/api/'))) {
      req.url = matched;
    }
  }
  next();
});

// Ensure uploads directory exists
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}
}
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/reports/public/maintenance', require('./routes/maintenance'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/reports/public/knowledge', require('./routes/knowledge'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api', require('./routes/photos'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    product: 'Civic Resolve AI',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    realUsersEnabled: true,
    authentication: 'JWT + BCrypt',
    timestamp: new Date().toISOString()
  });
});

// Resolve frontend static assets directory across local and serverless Vercel environments
const candidateDirs = [
  path.join(__dirname, '..', 'public'),
  path.join(process.cwd(), 'public'),
  path.join(__dirname, 'public')
];
const publicDir = candidateDirs.find(d => fs.existsSync(d)) || candidateDirs[0];
app.use(express.static(publicDir));

// Friendly page routing for HTML screens
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.get('/report', (req, res) => res.sendFile(path.join(publicDir, 'report.html')));
app.get('/report.html', (req, res) => res.sendFile(path.join(publicDir, 'report.html')));

app.get('/ai-result', (req, res) => res.sendFile(path.join(publicDir, 'ai-result.html')));
app.get('/ai-result.html', (req, res) => res.sendFile(path.join(publicDir, 'ai-result.html')));

const citizenDashboardFile = fs.existsSync(path.join(publicDir, 'dashboard.html')) ? 'dashboard.html' : 'citizen-dashboard.html';
const adminDashboardFile = fs.existsSync(path.join(publicDir, 'admin.html')) ? 'admin.html' : 'admin-dashboard.html';
const staffDashboardFile = fs.existsSync(path.join(publicDir, 'staff.html')) ? 'staff.html' : 'staff-dashboard.html';

app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, citizenDashboardFile)));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(publicDir, citizenDashboardFile)));
app.get('/citizen-dashboard', (req, res) => res.sendFile(path.join(publicDir, citizenDashboardFile)));
app.get('/citizen-dashboard.html', (req, res) => res.sendFile(path.join(publicDir, citizenDashboardFile)));

app.get('/reports', (req, res) => res.sendFile(path.join(publicDir, 'report-detail.html')));
app.get('/reports/:id', (req, res) => res.sendFile(path.join(publicDir, 'report-detail.html')));
app.get('/report-detail', (req, res) => res.sendFile(path.join(publicDir, 'report-detail.html')));
app.get('/report-detail.html', (req, res) => res.sendFile(path.join(publicDir, 'report-detail.html')));

app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, adminDashboardFile)));
app.get('/admin.html', (req, res) => res.sendFile(path.join(publicDir, adminDashboardFile)));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(publicDir, adminDashboardFile)));
app.get('/admin-dashboard.html', (req, res) => res.sendFile(path.join(publicDir, adminDashboardFile)));

app.get('/staff', (req, res) => res.sendFile(path.join(publicDir, staffDashboardFile)));
app.get('/staff.html', (req, res) => res.sendFile(path.join(publicDir, staffDashboardFile)));
app.get('/staff-dashboard', (req, res) => res.sendFile(path.join(publicDir, staffDashboardFile)));
app.get('/staff-dashboard.html', (req, res) => res.sendFile(path.join(publicDir, staffDashboardFile)));

// Feature A: Civic Transparency Scorecard (PRD F8)
const transparencyFile = fs.existsSync(path.join(publicDir, 'transparency.html')) ? 'transparency.html' : 'analytics.html';
app.get('/transparency', (req, res) => res.sendFile(path.join(publicDir, transparencyFile)));
app.get('/transparency.html', (req, res) => res.sendFile(path.join(publicDir, transparencyFile)));
app.get('/city-impact-transparency', (req, res) => res.sendFile(path.join(publicDir, transparencyFile)));
app.get('/city-impact-transparency.html', (req, res) => res.sendFile(path.join(publicDir, transparencyFile)));
app.get('/analytics', (req, res) => res.sendFile(path.join(publicDir, transparencyFile)));
app.get('/analytics.html', (req, res) => res.sendFile(path.join(publicDir, transparencyFile)));

// Feature B: Civic Digital Twin Geo Map (PRD F2)
app.get('/digital-twin', (req, res) => res.sendFile(path.join(publicDir, 'digital-twin.html')));
app.get('/digital-twin.html', (req, res) => res.sendFile(path.join(publicDir, 'digital-twin.html')));

// Feature C: Civic Maintenance Calendar (PRD F8)
app.get('/maintenance', (req, res) => res.sendFile(path.join(publicDir, 'maintenance.html')));
app.get('/maintenance.html', (req, res) => res.sendFile(path.join(publicDir, 'maintenance.html')));
app.get('/maintenance-calendar', (req, res) => res.sendFile(path.join(publicDir, 'maintenance.html')));
app.get('/maintenance-calendar.html', (req, res) => res.sendFile(path.join(publicDir, 'maintenance.html')));

// Feature D: AI Civic Knowledge Center (PRD Section 4)
app.get('/knowledge', (req, res) => res.sendFile(path.join(publicDir, 'knowledge.html')));
app.get('/knowledge.html', (req, res) => res.sendFile(path.join(publicDir, 'knowledge.html')));
app.get('/knowledge-center', (req, res) => res.sendFile(path.join(publicDir, 'knowledge.html')));
app.get('/knowledge-center.html', (req, res) => res.sendFile(path.join(publicDir, 'knowledge.html')));

// Feature E: Predictive Problem Radar (PRD F3)
app.get('/radar', (req, res) => res.sendFile(path.join(publicDir, 'radar.html')));
app.get('/radar.html', (req, res) => res.sendFile(path.join(publicDir, 'radar.html')));
app.get('/problem-radar', (req, res) => res.sendFile(path.join(publicDir, 'radar.html')));
app.get('/problem-radar.html', (req, res) => res.sendFile(path.join(publicDir, 'radar.html')));

app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));

// Unknown route handler - returns 404 status and dedicated 404 page (never silently serves index.html)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  const notFoundFile = path.join(publicDir, '404.html');
  if (fs.existsSync(notFoundFile)) {
    return res.status(404).sendFile(notFoundFile);
  }
  res.status(404).send('<h1>404 Not Found</h1><p>The requested civic page does not exist.</p>');
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }
  console.error('[Server Error]', err.stack || err);
  res.status(500).json({ error: 'An unexpected internal error occurred.' });
});

if (require.main === module) {
  // PRD F5: Start lightweight background escalation checker (runs every 10 minutes)
  try {
    const { checkEscalations } = require('./services/escalation');
    checkEscalations();
    const interval = setInterval(checkEscalations, 10 * 60 * 1000);
    if (interval.unref) interval.unref();
  } catch (e) {
    console.warn('[Escalation] Background worker initialization note:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Civic Resolve AI Prototype Server Running on Port ${PORT}`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`  Mode: Demonstration Prototype (Synthetic Data Only)`);
    console.log(`====================================================`);
  });
}

module.exports = app;
