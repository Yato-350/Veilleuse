import { expect, test, type Page } from '@playwright/test';

/** Collects uncaught errors and console errors. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function press(page: Page, key: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
}

test('boots to the content warning then the title screen', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('#game')).toBeVisible();
  await page.waitForTimeout(2000);
  await press(page, 'Enter');
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => {
    const v = (window as unknown as { __veilleuse: { game: { top: { constructor: { name: string } } } } }).__veilleuse;
    return v.game.top?.constructor.name;
  });
  expect(top).toBe('TitleScene');
  expect(errors).toEqual([]);
});

test('starts a new game, enters a name and reaches the prologue', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.waitForTimeout(2000);
  await press(page, 'Enter');
  await page.waitForTimeout(1800);
  // "Nouvelle partie" is the first entry when there is no save.
  await press(page, 'Enter');
  await page.waitForTimeout(1200);
  await page.keyboard.type('Camille');
  await page.waitForTimeout(300);
  await press(page, 'Enter'); // submit
  await page.waitForTimeout(400);
  await press(page, 'Enter'); // confirm "Oui"
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const v = (window as unknown as { __veilleuse: { G: { state: { playerName: string } }; game: { top: { constructor: { name: string } } } } }).__veilleuse;
    return { name: v.G.state.playerName, top: v.game.top?.constructor.name };
  });
  expect(state.name).toBe('Camille');
  expect(state.top).toBe('WorldScene');
  expect(errors).toEqual([]);
});

test('every map loads without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug=map&map=test');
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => Object.keys((window as unknown as { __veilleuse: { MAPS: Record<string, unknown> } }).__veilleuse.MAPS));
  for (const id of ids) {
    await page.goto(`/?debug=map&map=${id}&spawn=default`);
    await page.waitForTimeout(400);
  }
  expect(errors).toEqual([]);
});

test('a battle runs a full turn', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug=battle&enemies=dev_dummy');
  await page.waitForTimeout(1500);
  await press(page, 'Enter'); // intro text
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // FRAPPER
  await page.waitForTimeout(700);
  await press(page, 'Enter'); // stop the bar
  await page.waitForTimeout(3000);
  await press(page, 'Enter', 3);
  await page.waitForTimeout(6000);
  expect(errors).toEqual([]);
});
