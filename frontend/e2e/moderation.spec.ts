import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const admin = {
  id: 'admin-e2e-1',
  email: 'admin@example.com',
  fullName: 'Moderator SaStrane',
  role: 'BOTH',
  emailNotifications: true,
  bio: null,
  skills: [],
  avatarUrl: null,
  isAdmin: true,
  createdAt: '2026-09-15T12:00:00.000Z',
};

const report = {
  id: 'report-e2e-1',
  reason: 'SCAM',
  details: 'Traži uplatu unaprijed.',
  status: 'OPEN',
  reporter: { id: 'user-e2e-2', fullName: 'Kenan Mehić' },
  reportedUser: {
    id: 'user-e2e-1',
    fullName: 'Tarik Selimović',
    suspended: false,
  },
  listing: { id: 'listing-e2e-1', title: 'Montaža TV-a', status: 'OPEN' },
  handledBy: null,
  handledAt: null,
  createdAt: '2026-11-06T10:00:00.000Z',
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
    limit: 20,
    totalPages: items.length ? 1 : 0,
  };
}

async function signIn(page: Page, user: object) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
}

test('lets an admin resolve a report and suspend the user', async ({
  page,
}) => {
  await signIn(page, admin);
  const calls: string[] = [];
  let open = true;
  await page.route(apiRoute('/admin/reports\\?status=OPEN'), (route) =>
    route.fulfill(json(listPage(open ? [report] : []))),
  );
  await page.route(apiRoute('/admin/reports/report-e2e-1$'), (route) => {
    calls.push(`PATCH ${route.request().postData()}`);
    open = false;
    return route.fulfill(json({ ...report, status: 'RESOLVED' }));
  });
  await page.route(apiRoute('/admin/users/user-e2e-1/suspend$'), (route) => {
    calls.push('suspend');
    return route.fulfill({ status: 204 });
  });

  await page.goto('/admin');
  await expect(page.getByText('Traži uplatu unaprijed.')).toBeVisible();
  await expect(page.getByText('Prevara ili sumnjiva ponuda')).toBeVisible();

  // Suspending asks first.
  await page.getByRole('button', { name: 'Suspenduj nalog' }).click();
  expect(calls).toEqual([]);
  await page.getByRole('button', { name: 'Potvrdi' }).click();
  await expect(page.getByText('Nalog je suspendovan.')).toBeVisible();

  await page.getByRole('button', { name: 'Riješeno' }).click();
  await expect(page.getByText('Nema otvorenih prijava.')).toBeVisible();
  expect(calls).toEqual(['suspend', 'PATCH {"status":"RESOLVED"}']);

  // The admin menu leads here.
  await page.getByRole('button', { name: new RegExp(admin.fullName) }).click();
  await expect(
    page.getByRole('link', { name: 'Prijave', exact: true }),
  ).toBeVisible();
});

test('keeps other users out of the admin page', async ({ page }) => {
  await signIn(page, { ...admin, id: 'user-e2e-3', isAdmin: false });
  let asked = false;
  await page.route(apiRoute('/admin/'), (route) => {
    asked = true;
    return route.fulfill(json({ message: 'Admins only' }, 403));
  });

  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: 'Stranica je samo za administratore' }),
  ).toBeVisible();
  expect(asked).toBe(false);
  await page.getByRole('button', { name: new RegExp(admin.fullName) }).click();
  await expect(
    page.getByRole('link', { name: 'Prijave', exact: true }),
  ).toHaveCount(0);
});
