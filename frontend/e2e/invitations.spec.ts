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

const client = {
  id: 'client-e2e-1',
  fullName: 'Tarik Selimović',
  avatarUrl: null,
};

const invitations = [
  {
    id: 'invitation-e2e-2',
    applied: false,
    listing: {
      id: 'listing-e2e-2',
      title: 'Montaža TV-a na zid',
      category: 'ASSEMBLY',
      location: 'SARAJEVO',
      budget: 40,
    },
    client,
    createdAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'invitation-e2e-1',
    applied: true,
    listing: {
      id: 'listing-e2e-1',
      title: 'Dostava namirnica',
      category: 'DELIVERY',
      location: 'ILIDZA',
      budget: null,
    },
    client,
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

// A backend that keeps the user's invitations between requests.
async function mockApi(page: Page) {
  const received = [...invitations];
  const declined: string[] = [];

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
    route.fulfill(json(listPage(received))),
  );
  await page.route(apiRoute('/invitations/[^/?]+$'), (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    declined.push(id);
    received.splice(
      received.findIndex((item) => item.id === id),
      1,
    );
    return route.fulfill({ status: 204 });
  });

  return declined;
}

test('shows the invitations and declines one', async ({ page }) => {
  const declined = await mockApi(page);
  await page.goto('/inbox?tab=invitations');

  await expect(page.getByRole('tab', { name: /Pozivi/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const list = page.getByRole('region', { name: 'Pozivi' });
  const open = list.getByRole('article').filter({ hasText: 'Montaža TV-a' });
  await expect(open).toContainText('Tarik Selimović');
  await expect(open).toContainText('te poziva da se prijaviš');
  await expect(open).toContainText('40 KM');
  await expect(
    open.getByRole('link', { name: 'Pogledaj i prijavi se' }),
  ).toHaveAttribute('href', '/listings/listing-e2e-2');

  // An invitation the user answered with an application.
  const answered = list
    .getByRole('article')
    .filter({ hasText: 'Dostava namirnica' });
  await expect(answered).toContainText('Prijava poslana');
  await expect(
    answered.getByRole('button', { name: 'Odbij poziv' }),
  ).toHaveCount(0);

  await open.getByRole('button', { name: 'Odbij poziv' }).click();
  await expect(page.getByText('Poziv je odbijen.')).toBeVisible();
  await expect(list.getByRole('article')).toHaveCount(1);
  expect(declined).toEqual(['invitation-e2e-2']);
});

test('suggests filling in the profile without invitations', async ({
  page,
}) => {
  await mockApi(page);
  await page.route(apiRoute('/invitations\\?'), (route) =>
    route.fulfill(json(listPage([]))),
  );
  await page.goto('/inbox?tab=invitations');

  await expect(
    page.getByRole('heading', { name: 'Još nema poziva' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Uredi profil' }),
  ).toHaveAttribute('href', '/settings');
});
