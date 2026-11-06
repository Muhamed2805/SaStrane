import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'executor-e2e-1',
  email: 'kenan@example.com',
  fullName: 'Kenan Mehić',
  role: 'BOTH',
  createdAt: '2026-09-15T12:00:00.000Z',
};

const listing = {
  id: 'listing-e2e-1',
  title: 'Košenje dvorišta',
  category: 'LAWN_MOWING',
  location: 'SARAJEVO',
  status: 'OPEN',
  budget: 50,
  createdAt: '2026-11-04T10:00:00.000Z',
  client: { id: 'client-e2e-1', fullName: 'Amra Hodžić', avatarUrl: null },
  coverPhoto: null,
};

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

// A backend that keeps the user's saved jobs between requests.
async function mockApi(page: Page) {
  const saved = new Set<string>();
  const requests: string[] = [];

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
  // The job list, and the user's own jobs in the workspace.
  await page.route(apiRoute('/listings\\?'), (route) =>
    route.fulfill(
      json(
        listPage(route.request().url().includes('clientId=') ? [] : [listing]),
      ),
    ),
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
  await page.route(apiRoute('/saved-listings/ids$'), (route) =>
    route.fulfill(json([...saved])),
  );
  await page.route(apiRoute('/saved-listings\\?'), (route) =>
    route.fulfill(json(listPage(saved.has(listing.id) ? [listing] : []))),
  );
  await page.route(apiRoute('/saved-listings/listing-e2e-1$'), (route) => {
    const method = route.request().method();
    requests.push(method);
    if (method === 'PUT') saved.add(listing.id);
    else saved.delete(listing.id);
    return route.fulfill({ status: 204 });
  });

  return requests;
}

test('saves a job from the list and removes it under Saved', async ({
  page,
}) => {
  const requests = await mockApi(page);

  await page.goto('/listings');
  await page.getByRole('button', { name: 'Sačuvaj oglas' }).click();

  const unsave = page.getByRole('button', { name: 'Ukloni iz sačuvanih' });
  await expect(unsave).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Oglas je sačuvan.')).toBeVisible();
  expect(requests).toEqual(['PUT']);

  await page.goto('/inbox?tab=saved');
  await expect(page.getByRole('tab', { name: /Sačuvano/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText(listing.title)).toBeVisible();

  await unsave.click();
  await expect(
    page.getByRole('heading', { name: 'Još nemaš sačuvanih oglasa' }),
  ).toBeVisible();
  expect(requests).toEqual(['PUT', 'DELETE']);
});

test('asks a signed-out visitor to sign in before saving', async ({ page }) => {
  await page.route(apiRoute('/listings\\?'), (route) =>
    route.fulfill(json(listPage([listing]))),
  );

  await page.goto('/listings');
  await page.getByRole('button', { name: 'Sačuvaj oglas' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
});
