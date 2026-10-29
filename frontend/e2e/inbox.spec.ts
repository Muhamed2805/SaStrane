import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'user-e2e-1',
  email: 'korisnik@example.com',
  fullName: 'Test Korisnik',
  role: 'BOTH',
  createdAt: '2026-09-15T12:00:00.000Z',
};

const emptyPage = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function apiRoute(path: string) {
  return new RegExp(`${API.source}${path}`);
}

// A backend whose refresh cookie is valid. Every refresh issues a new
// access token, and only the newest one is accepted.
async function mockSignedInApi(page: Page) {
  let validToken = '';
  const calls = {
    refresh: 0,
    logout: 0,
    authorizations: [] as string[],
    // The server side of an expiry: the issued token stops working.
    expireAccessToken: () => {
      validToken = '';
    },
  };

  await page.route(apiRoute('/auth/refresh$'), (route) => {
    calls.refresh += 1;
    validToken = `access-token-${calls.refresh}`;
    return route.fulfill(json({ user, accessToken: validToken }));
  });
  await page.route(apiRoute('/auth/logout$'), (route) => {
    calls.logout += 1;
    return route.fulfill({ status: 204 });
  });
  await page.route(apiRoute('/listings\\?'), (route) =>
    route.fulfill(json(emptyPage)),
  );
  await page.route(apiRoute('/applications/'), (route) => {
    const authorization = route.request().headers()['authorization'] ?? '';
    calls.authorizations.push(authorization);
    if (!validToken || authorization !== `Bearer ${validToken}`) {
      return route.fulfill(json({ message: 'Unauthorized' }, 401));
    }
    const isList = /\/applications\/(?:my|received)\?/.test(
      route.request().url(),
    );
    return route.fulfill(json(isList ? emptyPage : []));
  });

  return calls;
}

async function markSignedIn(page: Page) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
}

const emptyApplications = (page: Page) =>
  page.getByRole('heading', { name: 'Još nisi poslao nijednu prijavu' });

test('restores the session from the refresh cookie on page load', async ({
  page,
}) => {
  const calls = await mockSignedInApi(page);
  await markSignedIn(page);

  await page.goto('/inbox');

  await expect(emptyApplications(page)).toBeVisible();
  await expect(
    page.getByText(user.fullName, { exact: true }).first(),
  ).toBeVisible();
  expect(calls.refresh).toBe(1);
  // The access token is kept in memory only.
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('access-token');
});

test('refreshes an expired access token once and repeats the requests', async ({
  page,
}) => {
  const calls = await mockSignedInApi(page);
  await markSignedIn(page);
  await page.goto('/inbox');
  await expect(emptyApplications(page)).toBeVisible();

  calls.expireAccessToken();
  calls.authorizations.length = 0;
  // A client-side navigation keeps the expired token in memory.
  await page.getByRole('button', { name: new RegExp(user.fullName) }).click();
  await page.getByRole('link', { name: 'Moj profil' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  const count = (token: string) =>
    calls.authorizations.filter((value) => value === `Bearer ${token}`).length;
  // Every rejected request is repeated once with the new token.
  await expect
    .poll(() => {
      const rejected = count('access-token-1');
      return rejected > 0 && count('access-token-2') === rejected;
    })
    .toBe(true);
  await expect(page.getByText('Statistika nije dostupna.')).toBeHidden();

  // One refresh on page load, and one shared by all rejected requests.
  expect(calls.refresh).toBe(2);
});

test('shows the sign-in prompt when the refresh cookie is no longer valid', async ({
  page,
}) => {
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ message: 'Invalid or expired refresh token' }, 401)),
  );
  await markSignedIn(page);

  await page.goto('/inbox');

  await expect(
    page.getByRole('heading', { name: 'Prijavi se za nastavak' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), SIGNED_IN_HINT_KEY),
    )
    .toBeNull();
});

test('signing out in one tab signs out the other tabs', async ({
  context,
  page,
}) => {
  const calls = await mockSignedInApi(page);
  await markSignedIn(page);
  await page.goto('/inbox');
  await expect(emptyApplications(page)).toBeVisible();

  const otherTab = await context.newPage();
  await mockSignedInApi(otherTab);
  await otherTab.goto('/inbox');
  await expect(emptyApplications(otherTab)).toBeVisible();

  await page.getByRole('button', { name: new RegExp(user.fullName) }).click();
  await page.getByRole('button', { name: 'Odjavi se' }).click();

  await expect(
    otherTab.getByRole('heading', { name: 'Prijavi se za nastavak' }),
  ).toBeVisible();
  expect(calls.logout).toBe(1);
});
