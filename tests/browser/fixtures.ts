import { test as base, expect } from '@playwright/test';
import { DEFAULT_DESIGN } from '../../src/customization.ts';

export const test = base.extend<{ garageLogin: void }, { profileId: string }>({
  profileId: [async ({ playwright }, use) => {
    const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5174', extraHTTPHeaders: { 'X-Garage-Request': '1' } });
    const response = await request.post('/api/profiles', { data: { name: '回归小车迷', avatar: '🐻', pin: '2468' } });
    expect(response.status()).toBe(201);
    const session = await response.json();
    await use(session.profile.id);
    await request.dispose();
  }, { scope: 'worker' }],
  garageLogin: [async ({ context, profileId }, use) => {
    const headers = { 'X-Garage-Request': '1' };
    const response = await context.request.post('/api/login', { headers, data: { id: profileId, pin: '2468' } });
    expect(response.ok()).toBeTruthy();
    const session = await response.json();
    const save = await context.request.put('/api/garage', { headers, data: { revision: session.revision, garage: { version: 1, draft: DEFAULT_DESIGN, cars: [] } } });
    expect(save.ok()).toBeTruthy();
    await use();
  }, { auto: true }],
});
export { expect };
