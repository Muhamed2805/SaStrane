import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'executor-e2e-1',
  email: 'kenan@example.com',
  fullName: 'Kenan Mehić',
  role: 'BOTH',
  emailNotifications: true,
  bio: null,
  skills: [],
  location: null,
  avatarUrl: null,
  createdAt: '2026-09-15T12:00:00.000Z',
};

// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

type Photo = {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  caption: string | null;
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

function png(name: string) {
  return { name, mimeType: 'image/png', buffer: PNG };
}

// A backend that keeps the user's gallery between requests.
async function mockApi(page: Page, portfolio: Photo[] = []) {
  const captions: string[] = [];

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/auth/me$'), (route) => route.fulfill(json(user)));
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
  await page.route(apiRoute('/notifications'), (route) =>
    route.fulfill(
      json(
        route.request().url().includes('unread-count')
          ? { count: 0 }
          : { items: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      ),
    ),
  );
  await page.route(apiRoute('/job-alerts$'), (route) =>
    route.fulfill(json([])),
  );
  await page.route('https://photos.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route(apiRoute(`/users/${user.id}$`), (route) =>
    route.fulfill(
      json({
        id: user.id,
        fullName: user.fullName,
        avatarUrl: null,
        bio: null,
        skills: [],
        location: null,
        createdAt: user.createdAt,
        rating: { average: null, count: 0 },
        clientRating: { average: null, count: 0 },
        stats: { completedJobs: 0, responseMinutes: null },
        portfolio,
      }),
    ),
  );
  await page.route(apiRoute('/auth/me/portfolio$'), (route) => {
    if (portfolio.length >= 8) {
      return route.fulfill(
        json({ code: 'PORTFOLIO_LIMIT_REACHED', message: 'Puno.' }, 409),
      );
    }
    const id = `work-${portfolio.length + 1}`;
    const photo = {
      id,
      url: `https://photos.test/${id}.webp`,
      thumbnailUrl: `https://photos.test/${id}-thumb.webp`,
      width: 800,
      height: 600,
      caption: null,
    };
    portfolio.push(photo);
    return route.fulfill(json(photo, 201));
  });
  await page.route(apiRoute('/auth/me/portfolio/[^/]+$'), (route) => {
    const id = route.request().url().split('/').at(-1);
    const index = portfolio.findIndex((photo) => photo.id === id);
    if (route.request().method() === 'DELETE') {
      portfolio.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    const { caption } = route.request().postDataJSON() as { caption: string };
    captions.push(caption);
    portfolio[index] = { ...portfolio[index], caption: caption || null };
    return route.fulfill(json(portfolio[index]));
  });

  return { portfolio, captions };
}

test('adds photos of work, captions one and removes one', async ({ page }) => {
  const { portfolio, captions } = await mockApi(page);
  await page.goto('/settings');

  const section = page.getByRole('region', { name: 'Galerija radova' });
  await page
    .getByTestId('portfolio-input')
    .setInputFiles([
      png('ormar.png'),
      png('kuhinja.png'),
      { name: 'ugovor.pdf', mimeType: 'application/pdf', buffer: PNG },
    ]);
  await expect(section.getByAltText('Slika rada 2')).toBeVisible();
  await expect(section.getByRole('alert')).toContainText(
    'ugovor.pdf: slika mora biti JPG, PNG, WebP ili AVIF datoteka.',
  );

  const caption = section.getByLabel('Opis slike rada 1');
  await caption.fill('  Ormar po mjeri ');
  await caption.press('Enter');
  await expect(page.getByText('Opis slike je sačuvan.')).toBeVisible();
  expect(captions).toEqual(['Ormar po mjeri']);
  await expect(section.getByAltText('Ormar po mjeri')).toBeVisible();

  page.on('dialog', (dialog) => void dialog.accept());
  await section.getByRole('button', { name: 'Ukloni sliku rada 2' }).click();
  await expect(page.getByText('Slika je uklonjena iz galerije.')).toBeVisible();
  await expect(section.getByAltText('Slika rada 2')).toHaveCount(0);
  expect(portfolio.map((photo) => photo.id)).toEqual(['work-1']);
});

test('takes at most eight photos', async ({ page }) => {
  await mockApi(page);
  await page.goto('/settings');

  const section = page.getByRole('region', { name: 'Galerija radova' });
  await page
    .getByTestId('portfolio-input')
    .setInputFiles(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => png(`${n}.png`)),
    );

  await expect(section.getByLabel(/^Opis slike rada \d$/)).toHaveCount(8);
  await expect(section.getByRole('alert')).toContainText(
    'Galerija može imati najviše 8 slika.',
  );
  await expect(
    section.getByRole('button', { name: 'Dodaj slike' }),
  ).toHaveCount(0);
});
