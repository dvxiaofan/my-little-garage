import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-ready', 'true');
}
async function snapshot(page: Page) {
  return page.evaluate(() => (window as any).__garageTest.snapshot());
}
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('a trip swaps the stage for the trail, spins the wheels, rocks the body, then returns everything', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await boot(page);
  await button(page, '车门').click();
  await button(page, '车灯').click();
  await expect.poll(async () => (await snapshot(page)).pose.doors).toBeGreaterThan(0.99);
  const parked = await snapshot(page);
  expect(parked.roadVisible).toBe(false);

  await button(page, '跑一跑').click();
  await expect(button(page, '跑一跑')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#drive-label')).toHaveText('出发啦');
  await expect(button(page, '车门')).toBeDisabled();
  await expect(button(page, '压一压')).toBeDisabled();
  await expect.poll(async () => (await snapshot(page)).pose.doors).toBeLessThan(0.05);
  await expect.poll(async () => (await snapshot(page)).state.driving).toBe('cruising');
  const moving = await snapshot(page);
  expect(moving.roadVisible).toBe(true);
  expect(moving.pose.distance).toBeGreaterThan(5);
  expect(Math.abs(moving.vehicle.wheelSpin)).toBeGreaterThan(5);
  expect(Math.abs(moving.vehicle.bodyPitch) + Math.abs(moving.vehicle.bodyRoll)).toBeGreaterThan(0.005);
  expect(moving.vehicle.lampsOn).toBe(true);
  const heights = moving.vehicle.wheelCenters.map((center: number[]) => center[1]);
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.01);
  await page.screenshot({ path: 'test-results/trip-desktop.png', fullPage: true });

  // Driving does not stop the child from looking around or customizing.
  await button(page, '侧面').click();
  await expect.poll(async () => (await snapshot(page)).camera[0]).toBeLessThan(-9);
  await page.getByRole('tab', { name: '改一改', exact: true }).click();
  await button(page, '大脚轮').click();
  await page.getByRole('tab', { name: '玩一玩', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).vehicle.design.wheels).toBe('crawler');
  expect((await snapshot(page)).roadVisible).toBe(true);

  await expect.poll(async () => (await snapshot(page)).state.driving, { timeout: 30_000 }).toBe('idle');
  const back = await snapshot(page);
  expect(back.roadVisible).toBe(false);
  expect(back.vehicle.bodyPitch).toBe(0);
  expect(back.state.doors).toBe(true);
  expect(back.state.lights).toBe(true);
  await expect(button(page, '车门')).toBeEnabled();
  await expect(button(page, '跑一跑')).toBeEnabled();
  await expect(page.locator('#discovery-text')).toContainText('跑完一圈');
  expect(errors).toEqual([]);
});

test('reset during a trip stops it and brings the stage back', async ({ page }) => {
  await boot(page);
  await button(page, '跑一跑').click();
  await expect.poll(async () => (await snapshot(page)).pose.distance).toBeGreaterThan(1);
  await button(page, '重来').click();
  const state = await snapshot(page);
  expect(state.state.driving).toBe('idle');
  expect(state.roadVisible).toBe(false);
  expect(state.pose.distance).toBe(0);
  await expect(button(page, '跑一跑')).toBeEnabled();
});
