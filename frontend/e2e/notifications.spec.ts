import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'user-e2e-1',
  email: 'amra@example.com',
  fullName: 'Amra Hodžić',
  role: 'BOTH',
  createdAt: '2026-09-15T12:00:00.000Z',
};

const notifications = [
  {
    id: 'notification-e2e-3',
    type: 'APPLICATION_ACCEPTED',
    listingId: 'listing-e2e-1',
    listingTitle: 'Montaža IKEA ormara',
    actorName: 'Tarik Selimović',
    readAt: null,
    createdAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'notification-e2e-2',
    type: 'NEW_APPLICATION',
    listingId: 'listing-e2e-2',
    listingTitle: 'Pomoć pri selidbi',
    actorName: 'Kenan Mehić',
    readAt: null,
    createdAt: '2026-11-06T09:00:00.000Z',
  },
  {
    id: 'notification-e2e-1',
    type: 'NEW_RATING',
    listingId: 'listing-e2e-3',
    listingTitle: 'Farbanje ograde',
    actorName: 'Lejla Begić',
    readAt: '2026-11-05T12:00:00.000Z',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
];

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

// A backend that keeps the read state between requests.
async function mockApi(page: Page, items = notifications) {
  const stored = items.map((item) => ({ ...item }));
  const read: string[] = [];

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
  await page.route(apiRoute('/listings\\?'), (route) =>
    route.fulfill(json(listPage([]))),
  );
  await page.route(apiRoute('/applications/'), (route) =>
    route.fulfill(json(listPage([]))),
  );
  await page.route(apiRoute('/saved-listings\\?'), (route) =>
    route.fulfill(json(listPage([]))),
  );
  await page.route(apiRoute('/invitations\\?'), (route) =>
    route.fulfill(json(listPage([]))),
  );
  await page.route(apiRoute('/notifications/unread-count$'), (route) =>
    route.fulfill(
      json({ count: stored.filter((item) => item.readAt === null).length }),
    ),
  );
  await page.route(apiRoute('/notifications\\?'), (route) =>
    route.fulfill(json(listPage(stored))),
  );
  await page.route(apiRoute('/notifications/read-all$'), (route) => {
    read.push('all');
    for (const item of stored) item.readAt ??= '2026-11-06T12:00:00.000Z';
    return route.fulfill({ status: 204 });
  });
  await page.route(apiRoute('/notifications/[^/]+/read$'), (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2) ?? '';
    read.push(id);
    const item = stored.find((entry) => entry.id === id);
    if (item) item.readAt ??= '2026-11-06T12:00:00.000Z';
    return route.fulfill({ status: 204 });
  });

  return read;
}

test('lists the notifications and opens one', async ({ page }) => {
  const read = await mockApi(page);
  await page.goto('/inbox?tab=invitations');

  const bell = page.getByRole('button', { name: 'Obavijesti, 2 nepročitanih' });
  await expect(bell).toBeVisible();
  await bell.click();

  const panel = page.getByRole('region', { name: 'Obavijesti' });
  const items = panel.getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Tvoja prijava je prihvaćena');
  await expect(items.nth(0)).toContainText('(nepročitano)');
  await expect(items.nth(0)).toContainText('Montaža IKEA ormara');
  await expect(items.nth(1)).toContainText('Nova prijava na tvoj oglas');
  await expect(items.nth(1).getByRole('link')).toHaveAttribute(
    'href',
    '/listings/listing-e2e-2',
  );
  await expect(items.nth(2)).toContainText('Nova ocjena za tvoj rad');
  await expect(items.nth(2)).not.toContainText('(nepročitano)');
  await expect(items.nth(2).getByRole('link')).toHaveAttribute(
    'href',
    '/users/user-e2e-1',
  );

  await items.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/inbox\?tab=applications$/);
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Obavijesti, 1 nepročitanih' }),
  ).toBeVisible();
  expect(read).toEqual(['notification-e2e-3']);
});

test('marks all as read', async ({ page }) => {
  const read = await mockApi(page);
  await page.goto('/inbox?tab=invitations');

  await page.getByRole('button', { name: /^Obavijesti, 2/ }).click();
  await page.getByRole('button', { name: 'Označi sve kao pročitano' }).click();

  await expect(
    page.getByRole('button', { name: 'Obavijesti', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Označi sve kao pročitano' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Obavijesti' }).getByText('(nepročitano)'),
  ).toHaveCount(0);
  expect(read).toEqual(['all']);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Obavijesti' })).toBeHidden();
});

test('explains the empty list on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await mockApi(page, []);
  await page.goto('/inbox?tab=invitations');

  await page.getByRole('button', { name: 'Obavijesti', exact: true }).click();
  await expect(page.getByText('Još nema obavijesti')).toBeVisible();
  const box = await page
    .getByRole('region', { name: 'Obavijesti' })
    .boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
});
