import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-ready', 'true');
}

async function snapshot(page: Page) {
  return page.evaluate(() => (window as any).__garageTest.snapshot());
}

test('initial real 3D scene is ready, quiet, usable, and has no browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await boot(page);
  await expect(page.getByRole('button', { name: '声音：已关闭', exact: true })).toHaveAttribute('aria-pressed', 'false');
  for (const name of ['车门', '前盖', '后箱', '车灯']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
  const state = await snapshot(page);
  expect(state.rendered).toBe(true);
  expect(state.renderer.triangles).toBeGreaterThan(1000);
  await page.getByRole('button', { name: '声音：已关闭', exact: true }).click();
  await expect(page.getByRole('button', { name: '声音：已开启', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '声音：已开启', exact: true }).click();
  await expect(page.getByRole('button', { name: '声音：已关闭', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/garage-desktop.png', fullPage: true });
});

test('combined actions preserve geometry and light state through camera changes and suspension', async ({ page }) => {
  await boot(page);
  const baseline = await snapshot(page);
  for (const name of ['车门', '前盖', '后箱', '车灯']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  await expect.poll(async () => (await snapshot(page)).pose.trunk).toBeGreaterThan(0.99);
  await page.getByRole('button', { name: '后面', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).camera[2]).toBeGreaterThan(6);
  await expect(page.getByRole('button', { name: '后面', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/garage-rear-open.png', fullPage: true });
  await page.getByRole('button', { name: '侧面', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).camera[0]).toBeLessThan(-9);
  await page.screenshot({ path: 'test-results/garage-side-open.png', fullPage: true });
  await page.getByRole('button', { name: '前面', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).camera[2]).toBeLessThan(-8);
  await expect(page.getByRole('button', { name: '前面', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '压一压', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).pose.compression, { intervals: [50] }).toBeGreaterThan(0.19);
  const compressed = await snapshot(page);
  expect(compressed.vehicle.wheelCenters).toEqual(baseline.vehicle.wheelCenters);
  expect(compressed.vehicle.bodyY).toBeLessThan(-0.19);
  expect(compressed.vehicle.lampsOn).toBe(true);
  expect(compressed.state.doors).toBe(true);
  expect(compressed.state.hood).toBe(true);
  expect(compressed.state.trunk).toBe(true);
  await expect.poll(async () => (await snapshot(page)).state.suspension).toBe('idle');
  await expect(page.getByRole('button', { name: '压一压', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '回正', exact: true }).click();
  await expect(page.getByRole('button', { name: '车灯', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '后箱', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('rapid reversing and resetting during a suspension cycle leave no stale actions', async ({ page }) => {
  await boot(page);
  const door = page.getByRole('button', { name: '车门', exact: true });
  await door.click();
  await door.click();
  await door.click();
  await expect.poll(async () => (await snapshot(page)).pose.doors).toBeGreaterThan(0.99);
  await page.getByRole('button', { name: '压一压', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).pose.compression, { intervals: [50] }).toBeGreaterThan(0.1);
  await page.getByRole('button', { name: '重来', exact: true }).click();
  const state = await snapshot(page);
  expect(state.pose).toEqual({ doors: 0, hood: 0, trunk: 0, lights: false, compression: 0, distance: 0 });
  await expect(page.getByRole('button', { name: '压一压', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-ready', 'true');
  expect((await snapshot(page)).state.suspension).toBe('idle');
});

test('mouse dragging rotates the camera without changing vehicle controls', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '前盖', exact: true }).click();
  const before = await snapshot(page);
  const bounds = (await page.locator('#scene canvas').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.68, bounds.y + bounds.height * 0.56, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).view).toBe('free');
  expect((await snapshot(page)).camera).not.toEqual(before.camera);
  await expect(page.getByRole('button', { name: '前盖', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('narrow screens keep the car and action controls accessible without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '车门', exact: true }).click();
  await expect(page.getByRole('button', { name: '车门', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/garage-narrow.png', fullPage: true });
});

test('unavailable WebGL shows a useful retry state instead of leaving an empty car stage', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: any[]) {
      if (kind.includes('webgl')) return null;
      return (original as any).call(this, kind, ...args);
    } as any;
  });
  await page.goto('/');
  await expect(page.getByText('小车还没准备好', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新试试', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '车门', exact: true })).toBeDisabled();
});
