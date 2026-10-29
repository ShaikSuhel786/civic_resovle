const { execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = require('../server/index.js');
const server = http.createServer(app);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const viewports = [1440, 1024, 768, 390, 375, 320];
const outDir = path.join(__dirname, '..', 'scratch_screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

server.listen(3059, async () => {
  console.log('QA Server running on port 3059');
  
  for (const w of viewports) {
    const outFile = path.join(outDir, `qa_${w}.png`);
    const cmd = `"${edgePath}" --headless=new --disable-gpu --virtual-time-budget=2000 --window-size=${w},950 --screenshot="${outFile}" http://localhost:3059/`;
    console.log(`Capturing ${w}px -> ${outFile}`);
    try {
      execSync(cmd, { stdio: 'pipe' });
      const sz = fs.statSync(outFile).size;
      console.log(`✓ ${w}px captured (${sz} bytes)`);
    } catch (e) {
      console.error(`✗ Error on ${w}px:`, e.message);
    }
  }

  server.close(() => {
    console.log('All QA captures complete.');
    process.exit(0);
  });
});

