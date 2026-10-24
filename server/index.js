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

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
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

// Serve frontend static assets
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Friendly page routing for HTML screens
app.get('/report', (req, res) => res.sendFile(path.join(publicDir, 'report.html')));
app.get('/ai-result', (req, res) => res.sendFile(path.join(publicDir, 'ai-result.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'citizen-dashboard.html')));
app.get('/reports/:id', (req, res) => res.sendFile(path.join(publicDir, 'report-detail.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin-dashboard.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(publicDir, 'staff-dashboard.html')));
app.get('/analytics', (req, res) => res.sendFile(path.join(publicDir, 'analytics.html')));
app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));

// Fallback to index.html for client-side navigation
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
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
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Civic Resolve AI Prototype Server Running on Port ${PORT}`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`  Mode: Demonstration Prototype (Synthetic Data Only)`);
    console.log(`====================================================`);
  });
}

module.exports = app;
