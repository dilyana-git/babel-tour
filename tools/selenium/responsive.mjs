import { assert, By, assertFitsViewport, waitForVisible, viewport } from './browser.mjs';

export default async function responsive(driver, baseUrl) {
  await driver.get(baseUrl);
  await waitForVisible(driver, '.map-enter');
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await viewport(driver, width, height);
    await assertFitsViewport(driver, ['#map-title', '.map-card', '.map-enter']);
    const enter = await driver.findElement(By.css('.map-enter'));
    assert(await enter.isEnabled(), `Enter control unavailable at ${width}px`);
  }

  await viewport(driver, 390, 844);
  await driver.sendDevToolsCommand('Emulation.setTouchEmulationEnabled', {
    enabled: true, maxTouchPoints: 1,
  });
  await driver.get(`${baseUrl}/?plates&dev=1`);
  await waitForVisible(driver, 'main.tour-root');
  await waitForVisible(driver, 'nav.air-acts');
  await assertFitsViewport(driver, ['.air-acts', '.chapter-mark']);
  await driver.findElement(By.css('button[aria-label="Show the navigation help"]')).click();
  await waitForVisible(driver, '.help-panel');
  await assertFitsViewport(driver, ['.help-panel', '.help-close']);
  assert.match(await driver.findElement(By.css('.help-body')).getText(), /Hold W to walk/i);
}
