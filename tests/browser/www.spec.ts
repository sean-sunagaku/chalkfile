import { test, expect } from '@playwright/test';

test('www は静的HTMLから同じパス・query・hashの apex へ移る', async ({ page, context, request }) => {
  const html = await (await request.get('/pstack-comedy/')).text();
  await context.route('https://www.chalkfile.com/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await context.route('https://chalkfile.com/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>apex</h1>' }));
  await page.goto('https://www.chalkfile.com/pstack-comedy/?from=www#P01');
  await expect(page).toHaveURL('https://chalkfile.com/pstack-comedy/?from=www#P01');
});
