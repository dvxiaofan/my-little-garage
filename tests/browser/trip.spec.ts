import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

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

for (const road of [
  { id: 'flat', name: '平路' },
  { id: 'hills', name: '连续小坡' },
  { id: 'alternating', name: '交错起伏' },
]) {
  test(road.name + ' controls the actual trip and preserves open parts after returning', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    await button(page, road.name).click();
    await expect(button(page, road.name)).toHaveAttribute('aria-pressed', 'true');
    expect((await snapshot(page)).roadKind).toBe(road.id);
    await button(page, '车门').click();
    await button(page, '车灯').click();
    await button(page, '跑一跑').click();
    for (const name of ['平路', '连续小坡', '交错起伏']) await expect(button(page, name)).toBeDisabled();
    await expect.poll(async () => (await snapshot(page)).pose.distance).toBeGreaterThan(18);
    const moving = await snapshot(page);
    expect(moving.roadVisible).toBe(true);
    expect(moving.roadKind).toBe(road.id);
    if (road.id === 'flat') {
      expect(moving.vehicle.bodyPitch).toBe(0);
      expect(moving.vehicle.bodyRoll).toBe(0);
    } else {
      const axis = road.id === 'hills' ? 'bodyPitch' : 'bodyRoll';
      await expect.poll(async () => Math.abs((await snapshot(page)).vehicle[axis])).toBeGreaterThan(0.01);
    }
    await page.screenshot({ path: 'test-results/road-' + road.id + '.png', fullPage: true });
    await expect.poll(async () => (await snapshot(page)).state.driving, { timeout: 12_000 }).toBe('idle');
    expect((await snapshot(page)).state.doors).toBe(true);
    expect((await snapshot(page)).state.lights).toBe(true);
    expect((await snapshot(page)).roadVisible).toBe(false);
    await expect(button(page, road.name)).toBeEnabled();
    await expect(button(page, road.name)).toHaveAttribute('aria-pressed', 'true');
  });
}

test.describe('iPad road controls', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  test('touch selection and reset allow another road without overflow or losing customization', async ({ page }) => {
    await boot(page);
    await page.getByRole('tab', { name: '改一改', exact: true }).tap();
    await button(page, '大脚轮').tap();
    await page.getByRole('tab', { name: '玩一玩', exact: true }).tap();
    await button(page, '交错起伏').tap();
    await button(page, '跑一跑').tap();
    await expect.poll(async () => (await snapshot(page)).pose.distance).toBeGreaterThan(1);
    await button(page, '重来').tap();
    expect((await snapshot(page)).roadVisible).toBe(false);
    expect((await snapshot(page)).roadKind).toBe('alternating');
    expect((await snapshot(page)).vehicle.design.wheels).toBe('crawler');
    await button(page, '平路').tap();
    await expect(button(page, '平路')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/roads-ipad.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await button(page, '连续小坡').tap();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/roads-narrow.png', fullPage: true });
  });
});
