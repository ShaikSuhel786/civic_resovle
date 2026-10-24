// Civic Resolve AI: Vercel Serverless Function Entrypoint
// Bridges Vercel serverless HTTP requests directly into the Express backend.

const app = require('../server/index.js');

module.exports = app;
