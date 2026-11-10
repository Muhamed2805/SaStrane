import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;

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

// Records the query of every job list request and answers with no jobs.
async function mockApi(page: Page) {
  const queries: URLSearchParams[] = [];
  await page.route(apiRoute('/listings\\?'), (route) => {
    queries.push(new URL(route.request().url()).searchParams);
    return route.fulfill(
      json({ items: [], total: 0, page: 1, limit: 9, totalPages: 0 }),
    );
  });
  return queries;
}

test('filters by budget and sorts, keeping both in the URL', async ({
  page,
}) => {
  const queries = await mockApi(page);
  await page.goto('/listings');
  await expect(page.getByText('Pronađeno 0 oglasa')).toBeVisible();

  // A reversed range is read the other way round.
  await page.getByLabel('Najmanji budžet u KM').fill('200');
  await page.getByLabel('Najmanji budžet u KM').press('Enter');
  await page.getByLabel('Najveći budžet u KM').fill('50');
  await page.getByLabel('Najveći budžet u KM').press('Enter');
  await expect(page).toHaveURL(/\?minBudget=50&maxBudget=200$/);
  await expect(page.getByLabel('Najmanji budžet u KM')).toHaveValue('50');
  await expect(page.getByLabel('Najveći budžet u KM')).toHaveValue('200');
  await expect(
    page.getByText('Bez oglasa s cijenom po dogovoru'),
  ).toBeVisible();

  await page
    .getByRole('combobox', { name: 'Sortiraj oglase' })
    .selectOption('BUDGET_HIGH');
  await expect(page).toHaveURL(/minBudget=50&maxBudget=200&sort=BUDGET_HIGH/);
  await expect
    .poll(() => {
      const last = queries.at(-1);
      return last ? Object.fromEntries(last) : null;
    })
    .toMatchObject({
      status: 'OPEN',
      minBudget: '50',
      maxBudget: '200',
      sort: 'BUDGET_HIGH',
    });

  // Clearing the filters keeps the sort.
  await page.getByRole('button', { name: 'Očisti filtere' }).click();
  await expect(page).toHaveURL(/\?sort=BUDGET_HIGH$/);
  await expect(page.getByLabel('Najmanji budžet u KM')).toHaveValue('');

  // Back brings the range into the fields again.
  await page.goBack();
  await expect(page.getByLabel('Najveći budžet u KM')).toHaveValue('200');
});

test('reads the budget and sort from a link', async ({ page }) => {
  await mockApi(page);
  await page.goto('/listings?maxBudget=80&sort=BUDGET_LOW');

  await expect(page.getByLabel('Najveći budžet u KM')).toHaveValue('80');
  await expect(
    page.getByRole('combobox', { name: 'Sortiraj oglase' }),
  ).toHaveValue('BUDGET_LOW');
});
