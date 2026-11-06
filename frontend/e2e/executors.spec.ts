import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;

const tarik = {
  id: 'executor-e2e-1',
  fullName: 'Tarik Selimović',
  avatarUrl: null,
  bio: 'Imam svoj alat i kombi. Montiram namještaj i vozim manje terete.',
  skills: ['ASSEMBLY', 'MOVING'],
  location: 'SARAJEVO',
  createdAt: '2026-09-15T12:00:00.000Z',
  rating: { average: 4.5, count: 2 },
};

const kenan = {
  id: 'executor-e2e-2',
  fullName: 'Kenan Mehić',
  avatarUrl: null,
  bio: null,
  skills: ['IT_HELP'],
  location: null,
  createdAt: '2026-09-20T12:00:00.000Z',
  rating: { average: null, count: 0 },
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

// Answers like the API: the skill filter and the search narrow the list.
async function mockExecutorsApi(page: Page) {
  const queries: URLSearchParams[] = [];
  await page.route(apiRoute('/users(\\?|$)'), (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    const skill = params.get('skill');
    const q = params.get('q')?.toLowerCase();
    const items = [tarik, kenan].filter(
      (executor) =>
        (!skill || executor.skills.includes(skill)) &&
        (!q ||
          executor.fullName.toLowerCase().includes(q) ||
          executor.bio?.toLowerCase().includes(q)),
    );
    return route.fulfill(
      json({
        items,
        total: items.length,
        page: 1,
        limit: 12,
        totalPages: items.length > 0 ? 1 : 0,
      }),
    );
  });
  return queries;
}

test('lists executors and filters them by job and search', async ({ page }) => {
  const queries = await mockExecutorsApi(page);
  await page.goto('/executors');

  await expect(
    page.getByRole('heading', { name: 'Pronađi pomoć u svojoj blizini' }),
  ).toBeVisible();
  await expect(page.getByText('Pronađena 2 izvođača')).toBeVisible();
  const tarikCard = page.getByRole('link', { name: /Tarik Selimović/ });
  await expect(tarikCard).toContainText('Sarajevo');
  await expect(tarikCard).toContainText('4,5');
  await expect(tarikCard).toContainText('2 ocjene');
  await expect(tarikCard).toContainText('Montaža');
  await expect(page.getByRole('link', { name: /Kenan Mehić/ })).toContainText(
    'Još nema ocjena',
  );

  await page.getByLabel('Filtriraj po poslu').selectOption('IT_HELP');
  await expect(page).toHaveURL(/\/executors\?skill=IT_HELP$/);
  await expect(page.getByText('Pronađen 1 izvođač')).toBeVisible();
  await expect(page.getByRole('link', { name: /Tarik/ })).toHaveCount(0);
  expect(queries.at(-1)?.get('skill')).toBe('IT_HELP');

  await page.getByRole('button', { name: 'Očisti filtere' }).click();
  await page.getByLabel('Pretraži izvođače').fill('kombi');
  await expect(page).toHaveURL(/\/executors\?q=kombi$/);
  await expect(page.getByText('Pronađen 1 izvođač')).toBeVisible();
  await expect(page.getByRole('link', { name: /Tarik/ })).toBeVisible();

  await page.getByLabel('Pretraži izvođače').fill('vodoinstalater');
  await expect(page.getByText('Nema izvođača')).toBeVisible();
  await page.getByRole('button', { name: 'Prikaži sve izvođače' }).click();
  await expect(page.getByText('Pronađena 2 izvođača')).toBeVisible();
});

test('reads the filters from the link and opens a profile', async ({
  page,
}) => {
  const queries = await mockExecutorsApi(page);
  await page.goto('/executors?skill=MOVING&location=SARAJEVO');

  await expect(page.getByLabel('Filtriraj po poslu')).toHaveValue('MOVING');
  await expect(page.getByLabel('Filtriraj po lokaciji')).toHaveValue(
    'SARAJEVO',
  );
  await expect.poll(() => queries.at(-1)?.get('location')).toBe('SARAJEVO');

  await page.getByRole('link', { name: /Tarik Selimović/ }).click();
  await expect(page).toHaveURL(`/users/${tarik.id}`);
});
