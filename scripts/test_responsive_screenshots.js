const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = require('../server/index.js');
const server = http.createServer(app);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const viewports = [320, 375, 390, 768, 1024, 1440];
const outDir = path.join(__dirname, '..', 'scratch_screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

server.listen(3058, async () => {
  console.log('Server running on port 3058');
  
  for (const w of viewports) {
    const outFile = path.join(outDir, `viewport_${w}.png`);
    const cmd = `"${edgePath}" --headless=new --disable-gpu --window-size=${w},1000 --screenshot="${outFile}" http://localhost:3058/`;
    console.log(`Capturing viewport ${w}px -> ${outFile}`);
    try {
      execSync(cmd, { stdio: 'pipe' });
      console.log(`✓ Viewport ${w}px captured successfully (${fs.statSync(outFile).size} bytes)`);
    } catch (e) {
      console.error(`✗ Error capturing ${w}px:`, e.message);
    }
  }

  server.close(() => {
    console.log('Done responsive capture.');
    process.exit(0);
  });
});

