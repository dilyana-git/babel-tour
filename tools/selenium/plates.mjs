import { assert, By, waitForVisible, waitUntil } from './browser.mjs';

export default async function plates(driver, baseUrl) {
  await driver.manage().window().setRect({ width: 1440, height: 900 });
  await driver.get(`${baseUrl}/?plates&dev=1`);
  await waitForVisible(driver, 'main.tour-root');
  const help = await waitForVisible(driver, 'button[aria-label="Show the navigation help"]');
  await help.click();
  await waitForVisible(driver, '[role="dialog"][aria-modal="true"]');
  await driver.findElement(By.css('.help-close')).click();
  await waitUntil(driver, async () => (await driver.findElements(By.css('.help-overlay'))).length === 0,
    'Help did not close');

  const mute = await waitForVisible(driver, 'button[aria-label="Mute the ambience"]');
  await mute.click();
  await waitForVisible(driver, 'button[aria-label="Unmute the ambience"]');

  const descend = await waitForVisible(driver, 'button[aria-label="Descend one gallery"]');
  await waitUntil(driver, () => descend.isEnabled(), 'Descend control did not become enabled', 90000);
  const before = await driver.executeScript('return window.__nav?.().target');
  assert(Number.isFinite(before), 'Dev navigation hook is available');
  await descend.click();
  await waitUntil(driver, async () => (await driver.executeScript('return window.__nav?.().target')) > before,
    'Descend control did not change the navigation target', 30000);
}
