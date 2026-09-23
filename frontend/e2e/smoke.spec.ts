import { expect, test, type Page } from '@playwright/test';

const listingsResponse = {
  items: [
    {
      id: 'listing-e2e-1',
      title: 'Pomoć pri selidbi',
      category: 'Selidbe',
      location: 'Sarajevo',
      budget: '100 KM',
      description: 'Potreban par ruku za selidbu namještaja.',
      createdAt: '2026-09-23T12:00:00.000Z',
      client: {
        id: 'client-e2e-1',
        fullName: 'Test Klijent',
      },
    },
  ],
  total: 1,
  page: 1,
  limit: 9,
  totalPages: 1,
};

async function mockListingsApi(page: Page) {
  await page.route(
    /^http:\/\/(?:localhost|127\.0\.0\.1):4000\/listings(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(listingsResponse),
      });
    },
  );
}

test.describe('authentication entry points', () => {
  test('opens the login dialog from the desktop navigation', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Prijava', exact: true }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Dobro došao nazad' }),
    ).toBeVisible();
  });

  test('opens registration directly from the desktop navigation', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByRole('button', { name: 'Registruj se', exact: true })
      .click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Kreiraj svoj račun' }),
    ).toBeVisible();
    await expect(page.getByLabel('Ime i prezime')).toBeVisible();
  });
});

test('loads the filtered listings catalog from the API', async ({ page }) => {
  await mockListingsApi(page);

  await page.goto('/listings?category=Selidbe');

  await expect(page.getByLabel('Filtriraj po kategoriji')).toHaveValue(
    'Selidbe',
  );
  await expect(page.getByText('Pronađen 1 oglas')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Pomoć pri selidbi' }),
  ).toBeVisible();
  await expect(page.getByText('Učitavanje oglasa...')).toBeHidden();
});

test('exposes authentication actions in the mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Otvori meni' }).click();

  const mobileNavigation = page.getByRole('navigation').filter({
    has: page.getByRole('button', { name: 'Registruj se', exact: true }),
  });
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation
    .getByRole('button', { name: 'Registruj se', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Kreiraj svoj račun' }),
  ).toBeVisible();
});
