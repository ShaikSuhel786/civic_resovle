// Civic Resolve AI: Vercel Serverless Function Entrypoint
// Bridges Vercel serverless HTTP requests directly into the Express backend with fail-safe error diagnostics.

let app = null;
let initError = null;

try {
  app = require('../server/index.js');
} catch (err) {
  initError = err;
  console.error('[Vercel Boot Error] Server initialization failed:', err.message, err.stack);
}

module.exports = (req, res) => {
  if (initError || !app) {
    const errorDetails = initError ? initError.message : 'Application initialization failed.';
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: `Civic Resolve AI Server Configuration Error: ${errorDetails}`,
      hint: errorDetails.includes('Production database')
        ? 'Please configure DATABASE_URL or POSTGRES_URL in your Vercel Project Settings -> Environment Variables to connect to your Supabase PostgreSQL database.'
        : errorDetails.includes('SESSION_SECRET')
        ? 'Please configure SESSION_SECRET (at least 32 characters) in your Vercel Project Settings -> Environment Variables.'
        : 'Please verify server configuration and environment variables.',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString()
    }));
  }

  return app(req, res);
};
