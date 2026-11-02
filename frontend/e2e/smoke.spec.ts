import { expect, test, type Page } from '@playwright/test';

const listingsResponse = {
  items: [
    {
      id: 'listing-e2e-1',
      title: 'Pomoć pri selidbi',
      category: 'MOVING',
      location: 'SARAJEVO',
      status: 'OPEN',
      budget: 1500,
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

// Returns the URLs of the requests the page sent.
async function mockListingsApi(page: Page) {
  const requests: URL[] = [];
  await page.route(
    /^https?:\/\/[^/]+\/api\/listings(?:\?.*)?$/,
    async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(listingsResponse),
      });
    },
  );
  return requests;
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
  const requests = await mockListingsApi(page);

  await page.goto('/listings?category=MOVING');

  const categoryFilter = page.getByLabel('Filtriraj po kategoriji');
  await expect(categoryFilter).toHaveValue('MOVING');
  await expect(categoryFilter.locator('option:checked')).toHaveText('Selidbe');
  await expect(page.getByText('Pronađen 1 oglas')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Pomoć pri selidbi' }),
  ).toBeVisible();
  await expect(page.getByText('1.500 KM')).toBeVisible();
  await expect(page.getByText('Učitavanje oglasa...')).toBeHidden();
  // The feed asks for open jobs in the chosen category only.
  expect(
    requests.map((url) => Object.fromEntries(url.searchParams)),
  ).toContainEqual(
    expect.objectContaining({ category: 'MOVING', status: 'OPEN' }),
  );
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
