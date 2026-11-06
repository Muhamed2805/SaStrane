import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';
const DAY_MS = 24 * 60 * 60_000;

const user = {
  id: 'client-e2e-1',
  email: 'amra@example.com',
  fullName: 'Amra Hodžić',
  role: 'CLIENT',
  createdAt: '2026-09-15T12:00:00.000Z',
};

function listing(id: string, title: string, expiresAt: string | null) {
  return {
    id,
    title,
    category: 'IT_HELP',
    location: 'SARAJEVO',
    status: expiresAt && Date.parse(expiresAt) < Date.now() ? 'CLOSED' : 'OPEN',
    budget: 40,
    createdAt: '2026-11-01T10:00:00.000Z',
    expiresAt,
    client: { id: user.id, fullName: user.fullName, avatarUrl: null },
    coverPhoto: null,
  };
}

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

function listPage(items: unknown[]) {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 10,
    totalPages: items.length ? 1 : 0,
  };
}

// A backend with three of the user's jobs: one expiring in two days, one
// with weeks left and one that expired.
async function mockApi(page: Page) {
  const inDays = (days: number) =>
    new Date(Date.now() + days * DAY_MS + 60 * 60_000).toISOString();
  const jobs = [
    listing('listing-soon', 'Reinstalacija Windowsa', inDays(2)),
    listing('listing-later', 'Montaža police', inDays(20)),
    listing('listing-old', 'Košenje trave', inDays(-3)),
  ];
  const extended: string[] = [];

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
  await page.route(apiRoute('/notifications'), (route) =>
    route.fulfill(
      json(
        route.request().url().includes('unread-count')
          ? { count: 0 }
          : listPage([]),
      ),
    ),
  );
  await page.route(apiRoute('/listings\\?'), (route) =>
    route.fulfill(json(listPage(jobs))),
  );
  await page.route(apiRoute('/applications/'), (route) =>
    route.fulfill(
      json(
        /\/applications\/(?:my|received)\?/.test(route.request().url())
          ? listPage([])
          : [],
      ),
    ),
  );
  await page.route(apiRoute('/listings/[^/]+/extend$'), (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2) ?? '';
    extended.push(id);
    const job = jobs.find((item) => item.id === id)!;
    job.expiresAt = inDays(30);
    return route.fulfill(json({ ...job, description: null, photos: [] }));
  });

  return extended;
}

test('extends a job that expires soon from the workspace', async ({ page }) => {
  const extended = await mockApi(page);
  await page.goto('/inbox?tab=listings');

  const soon = page
    .getByRole('article')
    .filter({ hasText: 'Reinstalacija Windowsa' });
  await expect(soon).toContainText('Ističe za 3 dana.');

  // Weeks left: nothing to do yet. Expired: marked, nothing to extend.
  const later = page.getByRole('article').filter({ hasText: 'Montaža police' });
  await expect(later).toBeVisible();
  await expect(later.getByRole('button', { name: /Produži/ })).toHaveCount(0);
  const old = page.getByRole('article').filter({ hasText: 'Košenje trave' });
  await expect(old).toContainText('Istekao');
  await expect(old.getByRole('button', { name: /Produži/ })).toHaveCount(0);

  await soon.getByRole('button', { name: 'Produži za 30 dana' }).click();
  await expect(page.getByText('Oglas je produžen za 30 dana.')).toBeVisible();
  await expect(soon.getByRole('button', { name: /Produži/ })).toHaveCount(0);
  expect(extended).toEqual(['listing-soon']);
});
