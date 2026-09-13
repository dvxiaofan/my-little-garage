import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_DESIGN } from '../../src/customization.ts';
import { STORAGE_KEY } from '../../src/design-store.ts';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-ready', 'true');
}
async function snapshot(page: Page) {
  return page.evaluate(() => (window as any).__garageTest.snapshot());
}
async function build(page: Page) {
  await page.getByRole('tab', { name: '改一改', exact: true }).click();
}
async function choose(page: Page, ...labels: string[]) {
  for (const name of labels) await page.getByRole('button', { name, exact: true }).click();
}

test('customized geometry keeps open parts, lights and grounded wheels through a suspension cycle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  await choose(page, '车门', '前盖', '后箱', '车灯');
  await expect.poll(async () => (await snapshot(page)).pose.trunk).toBeGreaterThan(0.99);
  await build(page);
  await choose(page, '森林绿', '大脚轮', '再高点', '小帐篷');
  await expect(page.locator('#discovery-text')).toContainText('小帐篷搭好啦');
  await page.getByLabel('给小车起个名', { exact: true }).fill('森林露营号');
  const customized = await snapshot(page);
  expect(customized.vehicle.design).toEqual({ name: '森林露营号', paint: 'green', wheels: 'crawler', height: 'high', roof: 'tent' });
  expect(customized.vehicle.paintColor).toBe('#6b9271');
  expect(customized.vehicle.wheelStyles).toEqual(Array.from({ length: 5 }, () => ['crawler']));
  expect(customized.vehicle.roof).toEqual({ cargo: false, tent: true });
  expect(customized.vehicle.bodyY).toBeCloseTo(0.46);
  expect(customized.vehicle.lampsOn).toBe(true);
  await choose(page, '回正');
  await page.getByRole('tab', { name: '玩一玩', exact: true }).click();
  await choose(page, '压一压');
  await expect.poll(async () => (await snapshot(page)).pose.compression, { intervals: [50] }).toBeGreaterThan(0.19);
  const compressed = await snapshot(page);
  expect(compressed.vehicle.wheelCenters).toEqual(customized.vehicle.wheelCenters);
  expect(customized.vehicle.bodyY - compressed.vehicle.bodyY).toBeGreaterThan(0.19);
  expect(compressed.vehicle.lampsOn).toBe(true);
  expect(compressed.state.doors && compressed.state.hood && compressed.state.trunk).toBe(true);
  await expect.poll(async () => (await snapshot(page)).state.suspension).toBe('idle');
  await choose(page, '重来');
  expect((await snapshot(page)).vehicle.design).toEqual(customized.vehicle.design);
  await build(page);
  await expect(page.getByRole('tab', { name: '改一改', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await snapshot(page)).cameraMoving).toBe(false);
  await page.screenshot({ path: 'test-results/workshop-desktop.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('distinct named cars survive reload, can be reopened, and are kept by restoring the original design', async ({ page }) => {
  await boot(page);
  await build(page);
  await choose(page, '天空蓝', '高一点', '行李箱');
  await page.getByLabel('给小车起个名', { exact: true }).fill('蓝天旅行号');
  await choose(page, '存进车库');
  await expect(page.locator('#saved-count')).toHaveText('1');
  await expect(page.locator('#save-label')).toHaveText('已经存好啦');
  await choose(page, '番茄红', '公路轮', '原来高', '不装');
  await page.getByLabel('给小车起个名', { exact: true }).fill('红豆小车');
  await choose(page, '存进车库', '存进车库');
  await expect(page.locator('#saved-count')).toHaveText('2');
  await page.reload();
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('heading', { name: '红豆小车', exact: true })).toBeVisible();
  expect((await snapshot(page)).vehicle.design.wheels).toBe('road');
  await build(page);
  await choose(page, '恢复原样');
  expect((await snapshot(page)).vehicle.design).toEqual(DEFAULT_DESIGN);
  await page.locator('#collection-button').click();
  await expect(page.getByRole('dialog', { name: /我的车库/ })).toBeVisible();
  await expect(page.locator('.saved-car')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/workshop-collection.png', animations: 'disabled' });
  await choose(page, '开出蓝天旅行号');
  expect((await snapshot(page)).vehicle.design).toEqual({ ...DEFAULT_DESIGN, name: '蓝天旅行号', paint: 'blue', height: 'raised', roof: 'cargo' });
  await expect(page.getByRole('tab', { name: '玩一玩' })).toHaveAttribute('aria-selected', 'true');
  await page.locator('#collection-button').click();
  await choose(page, '移走红豆小车');
  await expect(page.locator('.saved-car')).toHaveCount(1);
  await choose(page, '放回来');
  await expect(page.locator('.saved-car')).toHaveCount(2);
  await choose(page, '开出红豆小车');
  expect((await snapshot(page)).vehicle.design.paint).toBe('red');
  expect((await snapshot(page)).vehicle.design.wheels).toBe('road');
});

test('a full garage explains capacity without overwriting a car and makes room through a reversible removal', async ({ page }) => {
  await boot(page);
  await build(page);
  for (let i = 1; i <= 6; i++) {
    await page.getByLabel('给小车起个名', { exact: true }).fill('小车' + i);
    await choose(page, '存进车库');
  }
  await page.getByLabel('给小车起个名', { exact: true }).fill('新作品');
  await choose(page, '存进车库');
  await expect(page.locator('#collection-notice')).toContainText('停满 6 辆');
  await expect(page.locator('.saved-car')).toHaveCount(6);
  await choose(page, '移走小车1');
  await expect(page.locator('#collection-notice')).toBeHidden();
  await choose(page, '关上车库', '存进车库');
  await expect(page.locator('#saved-count')).toHaveText('6');
  await page.locator('#collection-button').click();
  await expect(page.getByRole('button', { name: '开出新作品', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '开出小车1', exact: true })).toHaveCount(0);
  await expect(page.locator('#undo-removal')).toBeHidden();
});

test('storage failures keep customization usable and clearly avoid promising persistence', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
  });
  await boot(page);
  await build(page);
  await choose(page, '天空蓝', '存进车库');
  await expect(page.locator('#draft-status')).toHaveText('暂时只在本次保留');
  await expect(page.locator('#save-label')).toHaveText('本次已收好');
  await expect(page.locator('#discovery-text')).toContainText('浏览器没能保存');
  await page.locator('#collection-button').click();
  await expect(page.locator('#storage-note')).toContainText('刷新后可能丢失');
  await choose(page, '开出越野小勇士');
  expect((await snapshot(page)).vehicle.design.paint).toBe('blue');
  await page.reload();
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-ready', 'true');
  expect((await snapshot(page)).vehicle.design).toEqual(DEFAULT_DESIGN);
});

test('broken stored data does not block loading, and saved names are displayed as text', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await boot(page);
  expect((await snapshot(page)).vehicle.design).toEqual(DEFAULT_DESIGN);
  await build(page);
  await page.getByLabel('给小车起个名', { exact: true }).fill('<b>小车</b>');
  await choose(page, '存进车库');
  await expect(page.locator('#vehicle-name')).toHaveText('<b>小车</b>');
  await expect(page.locator('#vehicle-name b')).toHaveCount(0);
  await page.locator('#collection-button').click();
  await expect(page.locator('.open-saved-car strong')).toHaveText('<b>小车</b>');
  await expect(page.locator('.open-saved-car b')).toHaveCount(0);
});

test('keyboard mode switching and narrow-screen saving keep controls and dialog within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.getByRole('tab', { name: '玩一玩', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '改一改', exact: true })).toBeFocused();
  await expect(page.locator('#build-panel')).toBeVisible();
  await choose(page, '太阳黄', '大脚轮', '小帐篷', '帮我起名', '存进车库');
  await expect(page.getByRole('heading', { name: '太阳露营家', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/workshop-narrow.png', fullPage: true, animations: 'disabled' });
  await page.locator('#collection-button').click();
  await expect(page.getByRole('button', { name: '开出太阳露营家', exact: true })).toBeVisible();
  const bounds = (await page.locator('#collection-dialog').boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.locator('#collection-dialog')).toBeHidden();
  await expect(page.locator('#collection-button')).toBeFocused();
  await page.getByLabel('给小车起个名', { exact: true }).fill('一二三四五六七八九十天地');
  await expect(page.locator('#vehicle-name')).toHaveClass(/long-name/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
