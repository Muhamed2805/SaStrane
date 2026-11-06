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

const stats = {
  users: 12,
  newUsers: 3,
  suspendedUsers: 1,
  openListings: 7,
  closedListings: 4,
  newListings: 2,
  applications: 20,
  newApplications: 5,
  openReports: 1,
};

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
  await page.route(apiRoute('/admin/stats$'), (route) =>
    route.fulfill(json(stats)),
  );
}

test('shows the totals and leads to each admin section', async ({ page }) => {
  await signIn(page, admin);

  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Pregled' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Korisnici\s*12/ }),
  ).toBeVisible();
  await expect(page.getByText('+3 u zadnjih 7 dana')).toBeVisible();
  await page.getByRole('link', { name: /Otvorene prijave\s*1/ }).click();
  await expect(page).toHaveURL(/\/admin\/reports$/);

  // The admin menu leads to the overview.
  await page.getByRole('button', { name: new RegExp(admin.fullName) }).click();
  await expect(
    page.getByRole('link', { name: 'Administracija', exact: true }),
  ).toBeVisible();
});

test('lets an admin resolve a report and suspend the user', async ({
  page,
}) => {
  await signIn(page, admin);
  const calls: string[] = [];
  let open = true;
  await page.route(apiRoute('/admin/reports\\?.*status=OPEN'), (route) =>
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

  await page.goto('/admin/reports');
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
});

test('finds users and closes a job', async ({ page }) => {
  await signIn(page, admin);
  const userSearches: string[] = [];
  await page.route(apiRoute('/admin/users\\?'), (route) => {
    const url = new URL(route.request().url());
    userSearches.push(url.searchParams.get('q') ?? '');
    return route.fulfill(
      json(
        listPage([
          {
            id: 'user-e2e-1',
            fullName: 'Tarik Selimović',
            email: 'tarik@example.com',
            role: 'CLIENT',
            avatarUrl: null,
            isAdmin: false,
            suspendedAt: null,
            emailVerified: true,
            createdAt: '2026-10-01T10:00:00.000Z',
            listings: 2,
            applications: 0,
            openReports: 1,
          },
        ]),
      ),
    );
  });
  let status = 'OPEN';
  await page.route(apiRoute('/admin/listings\\?'), (route) =>
    route.fulfill(
      json(
        listPage([
          {
            id: 'listing-e2e-1',
            title: 'Montaža TV-a',
            status,
            category: 'ASSEMBLY',
            location: 'SARAJEVO',
            createdAt: '2026-11-05T10:00:00.000Z',
            client: {
              id: 'user-e2e-1',
              fullName: 'Tarik Selimović',
              suspended: false,
            },
            applications: 3,
            openReports: 1,
          },
        ]),
      ),
    ),
  );
  let patched: string | null = null;
  await page.route(
    apiRoute('/admin/listings/listing-e2e-1/status$'),
    (route) => {
      patched = route.request().postData();
      status = 'CLOSED';
      return route.fulfill({ status: 204 });
    },
  );

  await page.goto('/admin/users');
  await expect(page.getByText('tarik@example.com')).toBeVisible();
  await page.getByLabel('Pretraži korisnike').fill('tarik');
  await expect.poll(() => userSearches.at(-1)).toBe('tarik');

  await page.getByRole('link', { name: 'Oglasi', exact: true }).click();
  await expect(page.getByText('Prijave na posao: 3')).toBeVisible();
  await page.getByRole('button', { name: 'Zatvori' }).click();
  await expect(page.getByText('Oglas je zatvoren.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Otvori ponovo' }),
  ).toBeVisible();
  expect(patched).toBe('{"status":"CLOSED"}');
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
    page.getByRole('link', { name: 'Administracija', exact: true }),
  ).toHaveCount(0);
});
