import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'client-e2e-1',
  email: 'amra@example.com',
  fullName: 'Amra Hodžić',
  role: 'BOTH',
  createdAt: '2026-09-15T12:00:00.000Z',
};

// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const listing = {
  id: 'listing-e2e-1',
  title: 'Košenje dvorišta',
  category: 'LAWN_MOWING',
  location: 'SARAJEVO',
  status: 'OPEN',
  budget: null,
  description: null,
  createdAt: '2026-11-04T10:00:00.000Z',
  client: { id: user.id, fullName: user.fullName },
  coverPhoto: null,
  photos: [],
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

async function signIn(page: Page) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
}

test('posts a job, then uploads its photos with the cover first', async ({
  page,
}) => {
  await signIn(page);
  const uploaded: string[] = [];
  await page.route(apiRoute('/listings$'), (route) =>
    route.request().method() === 'POST'
      ? route.fulfill(json(listing, 201))
      : route.fallback(),
  );
  await page.route(apiRoute('/listings/listing-e2e-1/photos$'), (route) => {
    const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
    const name = /name="photo"; filename="([^"]+)"/.exec(body)?.[1] ?? '';
    uploaded.push(name);
    return route.fulfill(
      json(
        {
          id: `photo-${uploaded.length}`,
          url: `https://photos.test/${name}.webp`,
          thumbnailUrl: `https://photos.test/${name}-thumb.webp`,
          width: 1,
          height: 1,
        },
        201,
      ),
    );
  });

  await page.goto('/listings/create');
  await page.getByLabel('Naslov oglasa').fill('Košenje dvorišta');

  const input = page.getByTestId('photo-input');
  await input.setInputFiles([png('a.png'), png('b.png')]);
  await expect(page.getByAltText('Slika 1: a.png')).toBeVisible();

  await page
    .getByRole('button', { name: 'Postavi sliku 2 kao naslovnu' })
    .click();
  await expect(page.getByAltText('Slika 1: b.png')).toBeVisible();

  await input.setInputFiles([
    png('c.png'),
    { name: 'ugovor.pdf', mimeType: 'application/pdf', buffer: PNG },
  ]);
  await expect(
    page.getByRole('alert').filter({ hasText: 'slik' }),
  ).toContainText(
    'ugovor.pdf: slika mora biti JPG, PNG, WebP ili AVIF datoteka.',
  );
  await page.getByRole('button', { name: 'Ukloni sliku 3' }).click();
  await expect(page.getByAltText('Slika 3: c.png')).toHaveCount(0);

  await page.getByRole('button', { name: 'Objavi oglas' }).click();

  await expect(page).toHaveURL(/\/listings\/listing-e2e-1$/);
  expect(uploaded).toEqual(['b.png', 'a.png']);
});

test('stops at five photos', async ({ page }) => {
  await signIn(page);
  await page.goto('/listings/create');

  await page
    .getByTestId('photo-input')
    .setInputFiles(['1', '2', '3', '4', '5', '6'].map((n) => png(`${n}.png`)));

  await expect(page.getByAltText(/^Slika \d: /)).toHaveCount(5);
  await expect(
    page.getByRole('alert').filter({ hasText: 'slik' }),
  ).toContainText('Oglas može imati najviše 5 slika.');
  await expect(page.getByRole('button', { name: 'Dodaj slike' })).toHaveCount(
    0,
  );
});

test('shows the cover photo on the job card', async ({ page }) => {
  await page.route('https://photos.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route(apiRoute('/listings(\\?.*)?$'), (route) =>
    route.fulfill(
      json({
        items: [
          {
            ...listing,
            photos: undefined,
            description: undefined,
            coverPhoto: {
              id: 'photo-1',
              url: 'https://photos.test/cover.webp',
              thumbnailUrl: 'https://photos.test/cover-thumb.webp',
              width: 1,
              height: 1,
            },
          },
        ],
        total: 1,
        page: 1,
        limit: 9,
        totalPages: 1,
      }),
    ),
  );

  await page.goto('/listings');

  const card = page.locator('a[href="/listings/listing-e2e-1"]');
  await expect(card.locator('img')).toHaveAttribute(
    'src',
    'https://photos.test/cover-thumb.webp',
  );
});
