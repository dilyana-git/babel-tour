#!/usr/bin/env node
import { startApp, startBrowser } from './browser.mjs';
import world from './world.mjs';
import plates from './plates.mjs';
import responsive from './responsive.mjs';

const cases = { world, plates, responsive };
const selected = process.argv.slice(2);
for (const name of selected) {
  if (!(name in cases)) throw new Error(`Unknown suite "${name}". Choose: ${Object.keys(cases).join(', ')}`);
}

let app;
let browser;
let failed = false;
try {
  app = await startApp();
  browser = await startBrowser();
  for (const name of selected.length ? selected : Object.keys(cases)) {
    process.stdout.write(`[selenium] ${name} ... `);
    try {
      await cases[name](browser.driver, app.url);
      console.log('passed');
    } catch (error) {
      failed = true;
      console.log('FAILED');
      console.error(error.stack ?? error);
    }
  }
} catch (error) {
  failed = true;
  console.error(error.stack ?? error);
} finally {
  if (browser) await browser.stop();
  if (app) await app.stop();
}
if (failed) process.exitCode = 1;
