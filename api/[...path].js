// Civic Resolve AI: Vercel Serverless Function Catch-All Entrypoint
// Routes all /api/* requests directly into the Express backend.

const app = require('../server/index.js');

module.exports = app;
