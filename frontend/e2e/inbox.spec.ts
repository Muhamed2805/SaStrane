import { expect, test, type Page } from '@playwright/test';

const API_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):4000/;
const SILENT_REFRESH_INTERVAL = '10:00';

const user = {
  id: 'user-e2e-1',
  email: 'korisnik@example.com',
  fullName: 'Test Korisnik',
  role: 'BOTH',
  emailVerifiedAt: '2026-09-15T12:00:00.000Z',
  createdAt: '2026-09-15T12:00:00.000Z',
};

const emptyPage = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };

function json(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function mockSignedInApi(page: Page) {
  const calls = { refresh: 0, workspace: 0 };

  await page.route(new RegExp(`${API_ORIGIN.source}/auth/me$`), (route) =>
    route.fulfill(json(user)),
  );
  await page.route(
    new RegExp(`${API_ORIGIN.source}/auth/refresh$`),
    (route) => {
      calls.refresh += 1;
      return route.fulfill(
        json({
          accessToken: `access-token-${calls.refresh + 1}`,
          refreshToken: `refresh-token-${calls.refresh + 1}`,
        }),
      );
    },
  );
  await page.route(
    new RegExp(`${API_ORIGIN.source}/applications/my/listing-ids$`),
    (route) => route.fulfill(json([])),
  );
  await page.route(
    new RegExp(`${API_ORIGIN.source}/applications/my\\?`),
    (route) => {
      calls.workspace += 1;
      return route.fulfill(json(emptyPage));
    },
  );
  await page.route(
    new RegExp(`${API_ORIGIN.source}/applications/received\\?`),
    (route) => route.fulfill(json(emptyPage)),
  );
  await page.route(new RegExp(`${API_ORIGIN.source}/listings\\?`), (route) =>
    route.fulfill(json(emptyPage)),
  );

  return calls;
}

test('keeps the inbox loaded when the access token is silently refreshed', async ({
  page,
}) => {
  await page.clock.install();
  const calls = await mockSignedInApi(page);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          token: 'access-token-1',
          refreshToken: 'refresh-token-1',
        },
        version: 0,
      }),
    );
  });

  const emptyApplications = page.getByRole('heading', {
    name: 'Još nisi poslao nijednu prijavu',
  });

  await page.goto('/inbox');
  await expect(emptyApplications).toBeVisible();
  expect(calls.workspace).toBe(1);

  await page.clock.fastForward(SILENT_REFRESH_INTERVAL);
  await expect.poll(() => calls.refresh).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('auth-storage')),
    )
    .toContain('access-token-2');

  // Give a token-driven reload time to start before checking it did not.
  await page.waitForTimeout(500);
  expect(calls.workspace).toBe(1);
  await expect(emptyApplications).toBeVisible();
});
