import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_DESIGN } from '../../src/customization.ts';
import { STORAGE_KEY } from '../../src/design-store.ts';
const base = 'http://127.0.0.1:5174';
const headers = { 'X-Garage-Request': '1' };
const ready = (page: Page) => expect(page.locator('#scene canvas')).toHaveAttribute('data-ready', 'true');
const saved = (page: Page) => expect(page.locator('#family-status')).toHaveText('已保存到家庭车库');
async function register(page: Page, name: string) {
  const response = await page.request.post('/api/profiles', { headers, data: { name, avatar: '🐱', pin: '2468' } });
  expect(response.status()).toBe(201);
  return response.json();
}
async function login(page: Page, name: string) {
  await page.goto(base);
  await page.getByRole('button', { name: '进入' + name, exact: true }).click();
  await page.getByLabel('4 位数字口令', { exact: true }).fill('2468');
  await page.getByRole('button', { name: '打开车库', exact: true }).click();
  await ready(page);
}
async function saveCar(page: Page, name: string) {
  await page.getByRole('tab', { name: '改一改', exact: true }).click();
  await page.getByLabel('给小车起个名', { exact: true }).fill(name);
  await page.getByRole('button', { name: '存进车库', exact: true }).click();
  await saved(page);
}

test('create a child, open the same garage on another device, and switch without leaking cars', async ({ page, browser }) => {
  const other = await browser.newContext({ baseURL: base, viewport: { width: 820, height: 1180 }, hasTouch: true });
  const second = await other.newPage();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: '＋ 添加小朋友', exact: true }).click();
    await page.getByLabel('小朋友的名字').fill('小禾');
    await page.getByRole('button', { name: '头像 🦊' }).click();
    await page.getByLabel('4 位数字口令', { exact: true }).fill('2468');
    await page.getByLabel('再输入一次口令').fill('0000');
    await page.getByRole('button', { name: '创建我的车库' }).click();
    await expect(page.locator('#form-error')).toContainText('两次口令不一样');
    await page.getByLabel('再输入一次口令').fill('2468');
    await page.getByRole('button', { name: '创建我的车库' }).click();
    await ready(page);
    await saveCar(page, '小禾的蓝车');
    await login(second, '小禾');
    await expect(second.locator('#vehicle-name')).toHaveText('小禾的蓝车');
    await expect(second.locator('#saved-count')).toHaveText('1');
    await second.screenshot({ path: 'test-results/family-ipad.png', fullPage: true });
    await page.getByRole('button', { name: '换小朋友', exact: true }).click();
    await expect(page.getByRole('heading', { name: '谁来开小车？' })).toBeVisible();
    await page.screenshot({ path: 'test-results/family-entry.png', fullPage: true });
    await page.getByRole('button', { name: '进入小禾', exact: true }).click();
    await page.getByLabel('4 位数字口令', { exact: true }).fill('0000');
    await page.getByRole('button', { name: '打开车库', exact: true }).click();
    await expect(page.locator('#form-error')).toContainText('口令不对');
    await expect(page.locator('#scene')).toHaveCount(0);
    await page.getByRole('button', { name: '← 返回选择', exact: true }).click();
    await page.getByRole('button', { name: '＋ 添加小朋友', exact: true }).click();
    await page.getByLabel('小朋友的名字').fill('小麦');
    await page.getByLabel('4 位数字口令', { exact: true }).fill('2468');
    await page.getByLabel('再输入一次口令').fill('2468');
    await page.getByRole('button', { name: '创建我的车库' }).click();
    await ready(page);
    await expect(page.locator('#saved-count')).toHaveText('0');
    await expect(page.locator('#vehicle-name')).toHaveText(DEFAULT_DESIGN.name);
    await expect(second.locator('#saved-count')).toHaveText('1');
  } finally { await other.close(); }
});

test('conflicting devices preserve the newer remote work and can back up before reloading', async ({ page, browser }) => {
  await register(page, '冲突小车迷');
  await page.goto('/'); await ready(page);
  const other = await browser.newContext({ baseURL: base });
  const second = await other.newPage();
  try {
    await login(second, '冲突小车迷');
    await saveCar(page, '先保存的作品');
    await second.getByRole('tab', { name: '改一改', exact: true }).click();
    await second.getByLabel('给小车起个名', { exact: true }).fill('另一台的作品');
    await expect(second.locator('#family-status')).toHaveText('另一台设备更新了车库');
    expect((await (await page.request.get('/api/garage')).json()).garage.draft.name).toBe('先保存的作品');
    await second.getByRole('button', { name: '处理未保存作品' }).click();
    await second.screenshot({ path: 'test-results/family-conflict.png', fullPage: true });
    const downloaded = second.waitForEvent('download');
    await second.getByRole('button', { name: '备份本次作品并读取最新车库' }).click();
    expect((await downloaded).suggestedFilename()).toContain('小车库');
    await expect(second.locator('#manage-status')).toHaveText('已保存到家庭车库');
    await second.getByRole('button', { name: '关闭车库管理' }).click();
    await expect(second.locator('#vehicle-name')).toHaveText('先保存的作品');
  } finally { await other.close(); }
});

test('network errors cannot claim saved or silently switch users; retry saves the same work', async ({ page }) => {
  await register(page, '网络小车迷');
  await page.goto('/'); await ready(page);
  await page.route('**/api/garage', route => route.abort());
  await page.getByRole('tab', { name: '改一改', exact: true }).click();
  await page.getByLabel('给小车起个名', { exact: true }).fill('断网时的作品');
  await expect(page.locator('#family-status')).toHaveText('尚未保存，请重试');
  await page.getByRole('button', { name: '换小朋友' }).click();
  await expect(page.locator('#manage-error')).toContainText('还有作品没有保存');
  await page.getByRole('button', { name: '关闭车库管理' }).click();
  await page.unroute('**/api/garage');
  await page.getByRole('button', { name: '重试保存' }).click();
  await saved(page);
  await page.reload(); await ready(page);
  await expect(page.locator('#vehicle-name')).toHaveText('断网时的作品');
  await page.request.post('/api/logout', { headers, data: {} });
  await page.getByRole('tab', { name: '改一改', exact: true }).click();
  await page.getByLabel('给小车起个名', { exact: true }).fill('会话失效的作品');
  await expect(page.locator('#family-status')).toHaveText('登录已失效，请重新进入');
});

test('legacy work is imported only after preview and confirmation, with deduplication', async ({ page }) => {
  await register(page, '迁移小车迷');
  const legacy = { version: 1, draft: { ...DEFAULT_DESIGN, name: '旧蓝车', paint: 'blue' }, cars: [{ id: 'legacy-1', design: { ...DEFAULT_DESIGN, name: '旧蓝车', paint: 'blue' } }] };
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: legacy });
  await page.goto('/'); await ready(page);
  await expect(page.locator('#family-dialog')).toBeVisible();
  expect((await (await page.request.get('/api/garage')).json()).garage.cars).toHaveLength(0);
  await page.getByRole('button', { name: '查看本机旧作品' }).click();
  await expect(page.locator('#import-names')).toContainText('旧蓝车');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect((await (await page.request.get('/api/garage')).json()).garage.cars).toHaveLength(0);
  await page.getByRole('button', { name: '查看本机旧作品' }).click();
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await expect(page.locator('#manage-error')).toContainText('已带入 1 辆');
  await page.getByRole('button', { name: '关闭车库管理' }).click();
  await expect(page.locator('#saved-count')).toHaveText('1');
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(JSON.stringify(legacy));
  await page.reload(); await ready(page);
  await expect(page.locator('#family-dialog')).not.toBeVisible();
  await expect(page.locator('#saved-count')).toHaveText('1');
});

test('four PIN cells preserve leading zeros, editing, paste and form resets', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ 添加小朋友', exact: true }).click();
  const pin = page.getByLabel('4 位数字口令', { exact: true });
  const cells = page.locator('#child-pin-cells .pin-cell');
  await expect(cells).toHaveCount(4);
  await expect(page.locator('#confirm-pin-cells .pin-cell')).toHaveCount(4);
  await expect(pin).toHaveAttribute('type', 'password');
  await expect(pin).toHaveAttribute('inputmode', 'numeric');
  await pin.pressSequentially('012');
  await expect(cells).toHaveText(['●', '●', '●', '']);
  await pin.press('ArrowLeft');
  await expect(cells.nth(2)).toHaveAttribute('data-active', 'true');
  await pin.press('Backspace');
  await expect(pin).toHaveValue('02');
  await pin.press('ControlOrMeta+A');
  await pin.evaluate(input => {
    const data = new DataTransfer(); data.setData('text/plain', '0123');
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(pin).toHaveValue('0123');
  await expect(cells).toHaveText(['●', '●', '●', '●']);
  const box = (await cells.nth(1).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await pin.press('8');
  await expect(pin).toHaveValue('0823');
  await pin.press('Tab');
  await expect(page.getByLabel('再输入一次口令')).toBeFocused();
  await page.getByRole('button', { name: '← 返回选择', exact: true }).click();
  await page.getByRole('button', { name: '＋ 添加小朋友', exact: true }).click();
  await expect(pin).toHaveValue('');
  await expect(cells).toHaveText(['', '', '', '']);
  await page.getByLabel('小朋友的名字').fill('四格小车迷');
  await pin.fill('012');
  await page.getByLabel('再输入一次口令').fill('012');
  await page.getByRole('button', { name: '创建我的车库', exact: true }).click();
  await expect(pin).toHaveAttribute('aria-invalid', 'true');
  await pin.fill('0123');
  await page.getByLabel('再输入一次口令').fill('0123');
  await page.getByRole('button', { name: '创建我的车库', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: '换小朋友', exact: true }).click();
  await page.getByRole('button', { name: '进入四格小车迷', exact: true }).click();
  await expect(cells).toHaveCount(4);
  await expect(pin).toHaveValue('');
  await expect(page.locator('#confirm-pin-field')).toBeHidden();
  await pin.fill('0123');
  await page.getByRole('button', { name: '打开车库', exact: true }).click();
  await ready(page);
});

test.describe('touch entrance', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('four PIN cells stay touchable on small phones and only accept four digits', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await page.getByRole('button', { name: '＋ 添加小朋友', exact: true }).tap();
      const pin = page.getByLabel('4 位数字口令', { exact: true });
      const cells = page.locator('#child-pin-cells .pin-cell');
      await expect(cells).toHaveCount(4);
      await pin.tap();
      await pin.pressSequentially('0a1b2345');
      await expect(pin).toHaveValue('0123');
      const bounds = await cells.evaluateAll(items => items.map(item => {
        const rect = item.getBoundingClientRect(); return { top: rect.top, width: rect.width, height: rect.height };
      }));
      expect(bounds.every(rect => rect.top === bounds[0].top && rect.width >= 48 && rect.height >= 48)).toBe(true);
      const layout = await page.evaluate(() => ({
        viewport: innerWidth, scroll: document.documentElement.scrollWidth,
        widths: ['.family-entry', '.entry-card', '.pin-field', '.avatar-choices'].map(selector => ({ selector, width: document.querySelector(selector)!.getBoundingClientRect().width })),
      }));
      expect(layout.scroll, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
      await page.screenshot({ path: 'test-results/pin-phone-' + width + '.png', fullPage: true });
    }
  });
  test('narrow-screen registration and backup-file confirmation stay usable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '＋ 添加小朋友', exact: true }).tap();
    await page.getByLabel('小朋友的名字').fill('触屏小车迷');
    await page.getByLabel('4 位数字口令', { exact: true }).fill('2468');
    await page.getByLabel('再输入一次口令').fill('2468');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/family-register-narrow.png', fullPage: true });
    await page.getByRole('button', { name: '创建我的车库' }).tap();
    await ready(page);
    await page.locator('#family-manage').tap();
    const backup = { version: 1, draft: { ...DEFAULT_DESIGN, name: '从文件带来的车' }, cars: [] };
    await page.locator('#import-file').setInputFiles({ name: 'garage.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(page.locator('#import-confirm')).toBeVisible();
    expect((await (await page.request.get('/api/garage')).json()).garage.cars).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/family-import-narrow.png', fullPage: true });
    await page.getByRole('button', { name: '确认导入', exact: true }).tap();
    await expect(page.locator('#manage-error')).toContainText('已带入 1 辆');
    await page.getByRole('button', { name: '关闭车库管理' }).tap();
    await expect(page.locator('#saved-count')).toHaveText('1');
  });
});
