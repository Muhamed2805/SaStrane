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
      body: { fullName: 'Amra H.', role: 'BOTH' },
    },
  ]);
  // The navbar shows the new name right away.
  await expect(
    page.getByRole('button', { name: /Amra H\./ }).first(),
  ).toBeVisible();
  await expect(save).toBeDisabled();
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
