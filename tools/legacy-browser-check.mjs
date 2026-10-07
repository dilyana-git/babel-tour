// Start the server once for the retained plate, responsive and balcony suites.
// Child failures remain failures; no AI service or external test service runs.
import { spawn } from 'node:child_process';
import { startApp } from './selenium/browser.mjs';

let app;
let failed = false;
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true,
    env: { ...process.env, BABEL_TEST_URL: app.url } });
  child.once('error', reject);
  child.once('exit', code => resolve(code ?? 1));
});
try {
  app = await startApp({ hmr: false });
  for (const args of [['tools/selenium/run.mjs', 'plates', 'responsive'], ['tools/balcony-check.mjs']]) {
    console.log(`[legacy] Running ${args.join(' ')}`);
    try { if (await run(args) !== 0) failed = true; }
    catch (error) { failed = true; console.error(error.message); }
  }
} catch (error) { failed = true; console.error(error.stack ?? error); }
finally { await app?.stop(); }
if (failed) process.exitCode = 1;
