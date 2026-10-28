// Civic Resolve AI: Root Application Entrypoint
// Ensures `node .` and `node index.js` start the server directly

const app = require('./server/index.js');
const PORT = process.env.PORT || 3050;

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

