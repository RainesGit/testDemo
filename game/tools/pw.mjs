// pw.mjs — locate Playwright for the browser test scripts on any machine.
// Order: a local install (game/tools/node_modules or any parent), the global npm root, then the
// cloud container's /opt path. If none is found, print how to install it and exit.
//   npm i --prefix tools playwright && npx --prefix tools playwright install chromium
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

function globalRoot() {
  try { return execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

const candidates = ['playwright', globalRoot() && join(globalRoot(), 'playwright'), '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
let pw = null;
for (const c of candidates) {
  try { pw = require(c); break; } catch { /* try next */ }
}
if (!pw) {
  console.error('Playwright not found. Install it with:\n  npm i --prefix tools playwright && npx --prefix tools playwright install chromium');
  process.exit(2);
}
export default pw;
