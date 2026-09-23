import { expect, test, type Page } from '@playwright/test';

const API_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):4000/;
const email = 'novi.korisnik@example.com';
const validCode = '123456';

const verifiedUser = {
  id: 'user-e2e-1',
  email,
  fullName: 'Novi Korisnik',
  role: 'BOTH',
  createdAt: '2026-09-23T12:00:00.000Z',
};

type RequestPayload = Record<string, unknown> | null;

async function mockRegistrationApi(page: Page) {
  let registerPayload: RequestPayload = null;
  const verificationPayloads: RequestPayload[] = [];
  const resendPayloads: RequestPayload[] = [];

  await page.route(
    new RegExp(`${API_ORIGIN.source}/auth/register$`),
    async (route) => {
      registerPayload = route.request().postDataJSON() as RequestPayload;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          email,
          verificationRequired: true,
          expiresInSeconds: 600,
        }),
      });
    },
  );

  await page.route(
    new RegExp(`${API_ORIGIN.source}/auth/verify-email$`),
    async (route) => {
      const payload = route.request().postDataJSON() as RequestPayload;
      verificationPayloads.push(payload);

      if (payload?.code !== validCode) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 400,
            message: 'Kod nije ispravan ili je istekao.',
            error: 'Bad Request',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: verifiedUser,
          accessToken: 'e2e-access-token',
          refreshToken: 'e2e-refresh-token',
        }),
      });
    },
  );

  await page.route(
    new RegExp(`${API_ORIGIN.source}/auth/resend-verification$`),
    async (route) => {
      resendPayloads.push(route.request().postDataJSON() as RequestPayload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    },
  );

  await page.route(
    new RegExp(`${API_ORIGIN.source}/applications/my/listing-ids$`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    },
  );

  return {
    getRegisterPayload: () => registerPayload,
    verificationPayloads,
    resendPayloads,
  };
}

test('registers, handles an invalid code, resends, and verifies the account', async ({
  page,
}) => {
  await page.clock.install();
  const requests = await mockRegistrationApi(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.getByRole('button', { name: 'Registruj se', exact: true }).click();
  await page.getByLabel('Ime i prezime').fill(verifiedUser.fullName);
  await page.getByLabel('Email adresa').fill(email);
  await page.getByLabel('Lozinka', { exact: true }).fill('SigurnaLozinka123!');
  await page.getByRole('button', { name: 'Kreiraj račun' }).click();

  await expect(
    page.getByRole('heading', { name: 'Potvrdi svoj email' }),
  ).toBeVisible();
  await expect(
    page.getByText(`Poslali smo šestocifreni kod na ${email}.`),
  ).toBeVisible();
  expect(requests.getRegisterPayload()).toEqual({
    email,
    password: 'SigurnaLozinka123!',
    fullName: verifiedUser.fullName,
    role: 'BOTH',
  });

  await page.getByLabel('Verifikacijski kod').fill('000000');
  await page.getByRole('button', { name: 'Potvrdi i nastavi' }).click();

  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Kod nije ispravan ili je istekao.' }),
  ).toHaveText('Kod nije ispravan ili je istekao.');
  expect(requests.verificationPayloads).toEqual([{ email, code: '000000' }]);

  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: 'Pošalji novi kod' }).click();

  await expect(page.getByText('Novi kod je poslan.')).toBeVisible();
  expect(requests.resendPayloads).toEqual([{ email }]);

  await page.getByLabel('Verifikacijski kod').fill(validCode);
  await page.getByRole('button', { name: 'Potvrdi i nastavi' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByText(verifiedUser.fullName, { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('header')
      .getByRole('link', { name: 'Objavi oglas', exact: true }),
  ).toBeVisible();
  expect(requests.verificationPayloads).toEqual([
    { email, code: '000000' },
    { email, code: validCode },
  ]);
});
