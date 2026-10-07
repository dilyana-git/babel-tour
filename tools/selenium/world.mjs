import { assert, By, waitForVisible, waitUntil } from './browser.mjs';

export default async function world(driver, baseUrl) {
  await driver.manage().window().setRect({ width: 1440, height: 900 });
  await driver.get(baseUrl);
  const title = await waitForVisible(driver, '#map-title');
  assert.match(await title.getText(), /La Biblioteca de Babel/i);
  const enter = await waitForVisible(driver, '.map-enter');
  assert.match(await enter.getText(), /Enter /i);
  await waitUntil(driver, async () =>
    (await driver.findElements(By.css('.entry-map.is-world'))).length > 0,
  'The world did not finish assembling', 120000);
  await enter.click();
  const room = await waitForVisible(driver, '#room-title');
  assert((await room.getText()).trim(), 'The entered room has a title');
  await waitForVisible(driver, 'nav[aria-label="The walk"]');
  const map = await driver.findElement(By.css('button.room-map'));
  await waitUntil(driver, () => map.isEnabled(), 'Map control did not become enabled', 90000);
  await map.click();
  await waitUntil(driver, async () => (await driver.findElements(By.css('.room-hud'))).length === 0,
    'Map did not reopen', 90000);
  await waitForVisible(driver, '.map-enter');
}
