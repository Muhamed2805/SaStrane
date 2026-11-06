import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'executor-e2e-1',
  email: 'kenan@example.com',
  fullName: 'Kenan Mehić',
  role: 'BOTH',
  emailNotifications: true,
  bio: null,
  skills: [],
  location: null,
  avatarUrl: null,
  createdAt: '2026-09-15T12:00:00.000Z',
};

type Alert = {
  id: string;
  category: string | null;
  location: string | null;
  createdAt: string;
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

// A backend that keeps the user's job alerts between requests.
async function mockApi(page: Page) {
  const alerts: Alert[] = [];
  const created: unknown[] = [];

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/auth/me$'), (route) => route.fulfill(json(user)));
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
    route.fulfill(json(listPage([]))),
  );
  await page.route(apiRoute('/job-alerts$'), async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        category?: string;
        location?: string;
      };
      created.push(body);
      const alert = {
        id: `alert-${alerts.length + 1}`,
        category: body.category ?? null,
        location: body.location ?? null,
        createdAt: '2026-11-06T10:00:00.000Z',
      };
      alerts.unshift(alert);
      return route.fulfill(json(alert, 201));
    }
    return route.fulfill(json(alerts));
  });
  await page.route(apiRoute('/job-alerts/[^/?]+$'), (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    alerts.splice(
      alerts.findIndex((alert) => alert.id === id),
      1,
    );
    return route.fulfill({ status: 204 });
  });

  return created;
}

test('turns the chosen filters into an alert and removes it in settings', async ({
  page,
}) => {
  const created = await mockApi(page);

  // Without a filter there is nothing to watch.
  await page.goto('/listings');
  await expect(page.getByText('Pronađeno 0 oglasa')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Obavijesti me o novim oglasima' }),
  ).toHaveCount(0);

  await page.goto('/listings?category=MOVING&location=TUZLA');
  await page
    .getByRole('button', { name: 'Obavijesti me o novim oglasima' })
    .click();
  await expect(
    page.getByText('Javit ćemo ti kad se pojavi nov oglas.'),
  ).toBeVisible();
  await expect(page.getByText('Javljamo ti nove oglase')).toBeVisible();
  expect(created).toEqual([{ category: 'MOVING', location: 'TUZLA' }]);

  await page.goto('/settings');
  const section = page.getByRole('region', {
    name: 'Upozorenja za nove oglase',
  });
  await expect(section).toContainText('Selidbe · Tuzla');
  await section
    .getByRole('button', { name: 'Obriši upozorenje: Selidbe · Tuzla' })
    .click();
  await expect(page.getByText('Upozorenje je obrisano.')).toBeVisible();
  await expect(section).toContainText('Još nemaš upozorenja.');
});

test('asks a signed-out visitor to sign in first', async ({ page }) => {
  await page.route(apiRoute('/listings\\?'), (route) =>
    route.fulfill(json(listPage([]))),
  );

  await page.goto('/listings?location=TUZLA');
  await page
    .getByRole('button', { name: 'Obavijesti me o novim oglasima' })
    .click();

  await expect(page.getByRole('dialog')).toBeVisible();
});
