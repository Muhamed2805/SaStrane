import { expect, test, type Page } from '@playwright/test';

const API_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):4000/;
const email = 'postojeci.korisnik@example.com';
const validCode = '123456';
const newPassword = 'NovaSigurnaLozinka123!';

type RequestPayload = Record<string, unknown>;

async function mockPasswordResetApi(page: Page) {
  const forgotPasswordPayloads: RequestPayload[] = [];
  const resetPasswordPayloads: RequestPayload[] = [];

  await page.route(
    new RegExp(`${API_ORIGIN.source}/auth/forgot-password$`),
    async (route) => {
      forgotPasswordPayloads.push(
        route.request().postDataJSON() as RequestPayload,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    },
  );

  await page.route(
    new RegExp(`${API_ORIGIN.source}/auth/reset-password$`),
    async (route) => {
      const payload = route.request().postDataJSON() as RequestPayload;
      resetPasswordPayloads.push(payload);

      if (payload.code !== validCode) {
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
        body: JSON.stringify({ success: true }),
      });
    },
  );

  return { forgotPasswordPayloads, resetPasswordPayloads };
}

test('requests a reset code and sets a new password', async ({ page }) => {
  await page.clock.install();
  const requests = await mockPasswordResetApi(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.getByRole('button', { name: 'Prijava', exact: true }).click();
  await page.getByLabel('Email adresa').fill(email);
  await page.getByRole('button', { name: 'Zaboravljena lozinka?' }).click();

  await expect(
    page.getByRole('heading', { name: 'Zaboravljena lozinka' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email adresa')).toHaveValue(email);
  await page.getByRole('button', { name: 'Pošalji kod' }).click();

  await expect(
    page.getByRole('heading', { name: 'Postavi novu lozinku' }),
  ).toBeVisible();
  expect(requests.forgotPasswordPayloads).toEqual([{ email }]);

  await page.getByLabel('Kod iz emaila').fill('000000');
  await page.getByLabel('Nova lozinka', { exact: true }).fill(newPassword);
  await page.getByLabel('Potvrdi novu lozinku').fill('DrugaLozinka123!');
  await expect(page.getByText('Lozinke se ne podudaraju.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sačuvaj novu lozinku' }),
  ).toBeDisabled();

  await page.getByLabel('Potvrdi novu lozinku').fill(newPassword);
  await page.getByRole('button', { name: 'Sačuvaj novu lozinku' }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Kod nije ispravan ili je istekao.' }),
  ).toBeVisible();

  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: 'Pošalji novi kod' }).click();
  await expect(page.getByText('Novi kod je poslan.')).toBeVisible();
  expect(requests.forgotPasswordPayloads).toEqual([{ email }, { email }]);

  await page.getByLabel('Kod iz emaila').fill(validCode);
  await page.getByLabel('Nova lozinka', { exact: true }).fill(newPassword);
  await page.getByLabel('Potvrdi novu lozinku').fill(newPassword);
  await page.getByRole('button', { name: 'Sačuvaj novu lozinku' }).click();

  await expect(
    page.getByRole('heading', { name: 'Lozinka je promijenjena' }),
  ).toBeVisible();
  await expect(page.getByText('Nova lozinka je sačuvana.')).toBeVisible();
  expect(requests.resetPasswordPayloads).toEqual([
    { email, code: '000000', password: newPassword },
    { email, code: validCode, password: newPassword },
  ]);

  await page.getByRole('button', { name: 'Vrati se na prijavu' }).click();
  await expect(
    page.getByRole('heading', { name: 'Dobro došao nazad' }),
  ).toBeVisible();
});
