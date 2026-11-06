import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';
const PASSWORD = 'demo-password-123';

const user = {
  id: 'user-e2e-1',
  email: 'amra@example.com',
  fullName: 'Amra Hodžić',
  role: 'CLIENT',
  emailNotifications: true,
  bio: null as string | null,
  skills: [] as string[],
  location: null as string | null,
  avatarUrl: null as string | null,
  createdAt: '2026-09-15T12:00:00.000Z',
};

const AVATAR_URL = 'https://photos.test/avatars/user-e2e-1/avatar-1.webp';

// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/mZtZ4wAAAABJRU5ErkJggg==',
  'base64',
);

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

const wrongPassword = json(
  { code: 'WRONG_PASSWORD', message: 'Lozinka nije tačna.' },
  400,
);

// A signed-in user whose account endpoints check PASSWORD.
async function mockAccountApi(page: Page) {
  const state = {
    user: { ...user },
    requests: [] as Array<{ method: string; path: string; body: unknown }>,
    deleted: false,
  };

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    state.deleted
      ? route.fulfill(json({ message: 'Unauthorized' }, 401))
      : route.fulfill(json({ user: state.user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
  await page.route(apiRoute('/listings\?'), (route) =>
    route.fulfill(json(emptyPage)),
  );
  await page.route(apiRoute('/auth/(me|change-password)$'), async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const body = request.postDataJSON() as Record<string, string>;
    state.requests.push({ method, path, body });

    if (method === 'PATCH') {
      state.user = { ...state.user, ...body };
      return route.fulfill(json(state.user));
    }
    if (path === '/auth/change-password') {
      if (body.currentPassword !== PASSWORD) {
        return route.fulfill(wrongPassword);
      }
      return route.fulfill({ status: 204 });
    }
    if (body.password !== PASSWORD) return route.fulfill(wrongPassword);
    state.deleted = true;
    return route.fulfill({ status: 204 });
  });
  await page.route(apiRoute('/auth/me/avatar$'), (route) => {
    const request = route.request();
    const method = request.method();
    state.requests.push({
      method,
      path: '/auth/me/avatar',
      // Only that a file was sent matters here.
      body: method === 'PUT' ? request.postDataBuffer()?.length : undefined,
    });
    state.user = {
      ...state.user,
      avatarUrl: method === 'PUT' ? AVATAR_URL : null,
    };
    return route.fulfill(json(state.user));
  });
  await page.route(AVATAR_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );

  return state;
}

test('changes the name and the role', async ({ page }) => {
  const state = await mockAccountApi(page);
  await page.goto('/settings');

  const save = page.getByRole('button', { name: 'Sačuvaj promjene' });
  await expect(page.getByLabel('Email adresa')).toHaveValue(user.email);
  await expect(save).toBeDisabled();

  await page.getByLabel('Ime i prezime').fill('Amra H.');
  await page.getByText('Oboje').click();
  await save.click();

  await expect(page.getByText('Profil je sačuvan.')).toBeVisible();
  expect(state.requests).toEqual([
    {
      method: 'PATCH',
      path: '/auth/me',
      body: {
        fullName: 'Amra H.',
        role: 'BOTH',
        bio: '',
        skills: [],
        location: null,
      },
    },
  ]);
  // The navbar shows the new name right away.
  await expect(
    page.getByRole('button', { name: /Amra H\./ }).first(),
  ).toBeVisible();
  await expect(save).toBeDisabled();
});

test('writes an introduction and picks the jobs', async ({ page }) => {
  const state = await mockAccountApi(page);
  await page.goto('/settings');

  const save = page.getByRole('button', { name: 'Sačuvaj promjene' });
  await page.getByLabel('O meni').fill('  Imam kombi i radim vikendom.  ');
  await page.getByText('Selidbe').click();
  await page.getByText('Montaža').click();
  await page.getByText('Košenje trave').click();
  // A second click takes a job off again.
  await page.getByText('Montaža').click();
  await expect(page.getByRole('checkbox', { name: 'Selidbe' })).toBeChecked();
  await save.click();

  await expect(page.getByText('Profil je sačuvan.')).toBeVisible();
  expect(state.requests.at(-1)?.body).toEqual({
    fullName: user.fullName,
    role: user.role,
    bio: 'Imam kombi i radim vikendom.',
    // In the order of the list, not of the clicks.
    skills: ['LAWN_MOWING', 'MOVING'],
    location: null,
  });
  await expect(save).toBeDisabled();
});

test('picks and removes the location', async ({ page }) => {
  const state = await mockAccountApi(page);
  await page.goto('/settings');

  const save = page.getByRole('button', { name: 'Sačuvaj promjene' });
  const select = page.getByLabel('Gdje radiš');
  await select.selectOption({ label: 'Mostar' });
  await save.click();

  await expect(page.getByText('Profil je sačuvan.')).toBeVisible();
  expect(state.requests.at(-1)?.body).toMatchObject({ location: 'MOSTAR' });
  await expect(save).toBeDisabled();

  await select.selectOption({ label: 'Nije odabrano' });
  await save.click();
  await expect.poll(() => state.requests.length).toBe(2);
  expect(state.requests.at(-1)?.body).toMatchObject({ location: null });
});

test('adds and removes the profile photo', async ({ page }) => {
  const state = await mockAccountApi(page);
  await page.goto('/settings');

  const photoInput = page.getByLabel('Odaberi sliku profila');
  await photoInput.setInputFiles({
    name: 'dokument.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF'),
  });
  await expect(
    page.getByText('dokument.pdf: slika mora biti JPG, PNG, WebP ili AVIF'),
  ).toBeVisible();
  expect(state.requests).toEqual([]);

  await photoInput.setInputFiles({
    name: 'ja.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByText('Slika profila je sačuvana.')).toBeVisible();
  expect(state.requests).toEqual([
    { method: 'PUT', path: '/auth/me/avatar', body: expect.any(Number) },
  ]);
  // The navbar shows the photo too.
  await expect(page.locator(`img[src="${AVATAR_URL}"]`)).toHaveCount(2);

  await page.getByRole('button', { name: 'Ukloni' }).click();
  await expect(page.getByText('Slika profila je uklonjena.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dodaj sliku' })).toBeVisible();
  await expect(page.locator(`img[src="${AVATAR_URL}"]`)).toHaveCount(0);
});

test('turns the email notifications off and on', async ({ page }) => {
  const state = await mockAccountApi(page);
  await page.goto('/settings');

  const toggle = page.getByRole('switch', { name: 'Email obavijesti' });
  await expect(toggle).toBeChecked();

  await toggle.click();
  await expect(page.getByText('Email obavijesti su isključene.')).toBeVisible();
  await expect(toggle).not.toBeChecked();

  await toggle.click();
  await expect(page.getByText('Email obavijesti su uključene.')).toBeVisible();
  await expect(toggle).toBeChecked();
  expect(state.requests.map(({ body }) => body)).toEqual([
    { emailNotifications: false },
    { emailNotifications: true },
  ]);
});

test('changes the password after checking the fields', async ({ page }) => {
  const state = await mockAccountApi(page);
  await page.goto('/settings');

  const submit = page.getByRole('button', { name: 'Promijeni lozinku' });
  await page.getByLabel('Trenutna lozinka').fill('not-the-password');
  await page.getByLabel('Nova lozinka', { exact: true }).fill('a-new-password');
  await page.getByLabel('Ponovi novu lozinku').fill('a-different-one');
  await submit.click();
  await expect(page.getByText('Lozinke se ne podudaraju.')).toBeVisible();
  expect(state.requests).toEqual([]);

  await page.getByLabel('Ponovi novu lozinku').fill('a-new-password');
  await submit.click();
  await expect(page.getByText('Trenutna lozinka nije tačna.')).toBeVisible();

  await page.getByLabel('Trenutna lozinka').fill(PASSWORD);
  await submit.click();

  await expect(
    page.getByText('Lozinka je promijenjena. Ostali uređaji su odjavljeni.'),
  ).toBeVisible();
  await expect(page.getByLabel('Trenutna lozinka')).toHaveValue('');
  expect(state.requests.at(-1)).toEqual({
    method: 'POST',
    path: '/auth/change-password',
    body: { currentPassword: PASSWORD, newPassword: 'a-new-password' },
  });
});

test('deletes the account after the password and signs out', async ({
  page,
}) => {
  const state = await mockAccountApi(page);
  await page.goto('/settings');

  await page.getByRole('button', { name: 'Obriši nalog' }).click();
  const confirm = page.getByRole('button', { name: 'Trajno obriši nalog' });
  await expect(confirm).toBeDisabled();

  await page.getByLabel('Za potvrdu unesi lozinku').fill('wrong');
  await confirm.click();
  await expect(page.getByText('Lozinka nije tačna.')).toBeVisible();
  expect(state.deleted).toBe(false);

  await page.getByLabel('Za potvrdu unesi lozinku').fill(PASSWORD);
  await confirm.click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Nalog je obrisan.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prijava' }).first(),
  ).toBeVisible();
  expect(state.deleted).toBe(true);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SIGNED_IN_HINT_KEY),
  ).toBeNull();
});
