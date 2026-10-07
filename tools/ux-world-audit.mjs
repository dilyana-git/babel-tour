#!/usr/bin/env node
// Measure the default world's first-use path. Headless software GL screenshots
// tile the canvas on this project, so this audit records DOM/layout evidence.
// npm run review:world-ux  (or set BABEL_TEST_URL to a running Vite server)
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assert, By, startApp, startBrowser, waitForVisible, waitUntil } from './selenium/browser.mjs';

const out = resolve(process.argv[2] ?? '.ux-review/world-design-latest');
const app = await startApp();
let browser;
try {
  browser = await startBrowser({ pageLoadStrategy: 'none' });
  const { driver } = browser;
  await mkdir(out, { recursive: true });
  await driver.sendDevToolsCommand('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  // Record DOM milestones inside the page. WebDriver commands can be delayed
  // by software WebGL and would otherwise overstate when the map appeared.
  await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      window.__uxMarks = { map: null, ready: null, earlyEntry: false };
      const mark = () => {
        if (window.__uxMarks.map === null && document.querySelector('.map-enter'))
          window.__uxMarks.map = performance.now();
        if (document.querySelector('.entry-map.is-assembling .map-enter')
          && /when ready/i.test(document.querySelector('.map-enter').textContent || ''))
          window.__uxMarks.earlyEntry = true;
        if (window.__uxMarks.ready === null && document.querySelector('.entry-map.is-world'))
          window.__uxMarks.ready = performance.now();
      };
      new MutationObserver(mark).observe(document, { childList: true, subtree: true,
        attributes: true, attributeFilter: ['class'] });
    })();`,
  });
  await driver.get(app.url);
  const enter = await waitForVisible(driver, '.map-enter');
  const map = await driver.executeScript(() => {
    const card = document.querySelector('.map-card');
    const button = document.querySelector('.map-enter');
    const key = document.querySelector('.map-key');
    const stage = document.querySelector('.map-stage');
    const bounds = (el) => { const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
    return { viewport: { width: innerWidth, height: innerHeight },
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      card: bounds(card), button: bounds(button), key: key ? bounds(key) : null, stage: bounds(stage),
      pickerRooms: document.querySelectorAll('.map-room-picker .map-room-option').length,
      status: document.querySelector('.map-status')?.textContent,
      buttonText: button.textContent.trim() };
  });
  assert.equal(map.viewport.width, 390, 'Mobile viewport was not applied');

  await waitUntil(driver, async () =>
    (await driver.findElements(By.css('.entry-map.is-world'))).length > 0,
  'The world did not finish assembling', 120000);
  const marks = await driver.executeScript('return window.__uxMarks');
  assert(Number.isFinite(marks?.map) && Number.isFinite(marks?.ready), 'Page milestones were not captured');
  const mapVisibleMs = marks.map;
  const worldReadyMs = marks.ready;
  await enter.click();
  const clicked = Date.now();
  const room = await waitForVisible(driver, '#room-title', 120000);
  const enterToRoomMs = Date.now() - clicked;
  const roomTitle = await room.getText();

  const mapButton = await driver.findElement(By.css('button.room-map'));
  await waitUntil(driver, () => mapButton.isEnabled(), 'Map control stayed disabled', 90000);
  await mapButton.click();
  await waitUntil(driver, async () => (await driver.findElements(By.css('.room-hud'))).length === 0,
    'Map did not reopen', 120000);
  const result = { generatedAt: new Date().toISOString(), url: app.url,
    mapVisibleMs, worldReadyMs, enterToRoomMs, roomTitle, map, returnedToMap: true };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(result, null, 2));

  const ideas = [];
  if (worldReadyMs > 10000 && !marks.earlyEntry) ideas.push(
    `- Let visitors choose a destination while the 3D world loads. The map was visible after ${(mapVisibleMs / 1000).toFixed(1)} s, but the world was ready after ${(worldReadyMs / 1000).toFixed(1)} s in software-rendered Edge. Show progress and make the waiting state useful.`);
  if (map.stage.height < 320 && map.pickerRooms === 0) ideas.push(
    `- Give the mobile map a room list or swipeable chapter picker. Its map stage was ${map.stage.height} px high on a ${map.viewport.height} px screen; a text list would make all destinations easier to scan.`);
  if (enterToRoomMs > 5000) ideas.push(
    `- Give the entry transition a clearer progress cue. The room title appeared ${(enterToRoomMs / 1000).toFixed(1)} s after pressing Enter in software-rendered Edge.`);
  const report = `# Default world UX audit\n\nGenerated ${result.generatedAt}. Headless Edge with reduced motion and software WebGL.\n\n`
    + `| Check | Result |\n| --- | ---: |\n`
    + `| Map visible | ${(mapVisibleMs / 1000).toFixed(1)} s |\n`
    + `| 3D world ready | ${(worldReadyMs / 1000).toFixed(1)} s |\n`
    + `| Enter to room title | ${(enterToRoomMs / 1000).toFixed(1)} s |\n`
    + `| Mobile map stage | ${map.stage.width} × ${map.stage.height} px |\n`
    + `| Entry available during assembly | ${marks.earlyEntry ? 'Yes' : 'No'} |\n`
    + `| Mobile room picker | ${map.pickerRooms} rooms |\n`
    + `| Horizontal overflow | ${map.overflowX} px |\n`
    + `| Return to map | ${result.returnedToMap ? 'Passed' : 'Failed'} |\n\n`
    + `## Development ideas\n\n${ideas.length ? ideas.join('\n') : '- No threshold-based opportunities surfaced. Review the screenshots for qualitative ideas.'}\n\n`
    + `Measurements under software rendering are useful for spotting long waits, not representative device benchmarks.\n`;
  await writeFile(resolve(out, 'report.md'), report);
  assert(map.overflowX <= 2, `Mobile map overflowed by ${map.overflowX}px`);
  console.log(`[world-ux] report: ${resolve(out, 'report.md')}`);
  console.log(`[world-ux] map ${(mapVisibleMs / 1000).toFixed(1)}s, ready ${(worldReadyMs / 1000).toFixed(1)}s, enter ${(enterToRoomMs / 1000).toFixed(1)}s`);
} finally {
  if (browser) await browser.stop();
  await app.stop();
}
