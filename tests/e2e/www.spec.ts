import { expect, test } from './fixtures';

test('www は静的HTMLから同じパス・query・hashの apex へ移る', async ({ page, context, request, site }) => {
  const route = site.course.route;
  const html = await (await request.get(route)).text();
  await context.route('https://www.chalkfile.com/**', (r) =>
    r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
  );
  await context.route('https://chalkfile.com/**', (r) =>
    r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>apex</h1>' }),
  );
  const hash = site.course.lectures[0].id;
  await page.goto(`https://www.chalkfile.com${route}?from=www#${hash}`);
  await expect(page).toHaveURL(`https://chalkfile.com${route}?from=www#${hash}`);
});
