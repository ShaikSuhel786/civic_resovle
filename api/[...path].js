// Civic Resolve AI: Vercel Serverless Function Catch-All Entrypoint
// Routes all /api/* requests directly through the resilient error-boundary entrypoint.

module.exports = require('./index.js');
