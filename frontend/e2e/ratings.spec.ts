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

const emptyPage = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };

// An accepted application to a closed job, not rated yet.
const application = {
  id: 'application-e2e-1',
  listingId: 'listing-e2e-1',
  status: 'ACCEPTED',
  message: 'Mogu doći u subotu ujutro.',
  proposedPrice: 40,
  createdAt: '2026-11-01T10:00:00.000Z',
  listing: {
    title: 'Košenje dvorišta',
    category: 'LAWN_MOWING',
    location: 'SARAJEVO',
    status: 'CLOSED',
  },
  executor: {
    id: 'executor-e2e-1',
    fullName: 'Kenan Mehić',
    email: 'kenan@example.com',
    rating: { average: 4, count: 2 },
  },
  rating: null as null | {
    score: number;
    comment: string | null;
    createdAt: string;
  },
  canRate: true,
};

// The user's own accepted application to another client's closed job,
// with the client not rated yet.
const myApplication = {
  id: 'application-e2e-2',
  listingId: 'listing-e2e-2',
  status: 'ACCEPTED',
  message: 'Imam alat za montažu.',
  proposedPrice: 60,
  createdAt: '2026-10-28T10:00:00.000Z',
  listing: {
    title: 'Montaža ormara',
    category: 'ASSEMBLY',
    location: 'SARAJEVO',
    status: 'CLOSED',
  },
  rating: null,
  clientRating: null as null | {
    score: number;
    comment: string | null;
    createdAt: string;
  },
  canRateClient: true,
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

// A signed-in client with one received application to rate.
async function mockRatingsApi(page: Page) {
  const state = {
    application: { ...application },
    myApplication: { ...myApplication },
    posted: [] as unknown[],
    postedForClients: [] as unknown[],
  };

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: 0 })),
  );
  await page.route(apiRoute('/listings\\?'), (route) =>
    route.fulfill(json(emptyPage)),
  );
  await page.route(apiRoute('/applications/'), (route) => {
    const url = route.request().url();
    if (/\/applications\/received\?/.test(url)) {
      return route.fulfill(
        json({
          items: [state.application],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        }),
      );
    }
    if (/\/applications\/my\?/.test(url)) {
      return route.fulfill(
        json({
          items: [state.myApplication],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        }),
      );
    }
    return route.fulfill(json([]));
  });
  await page.route(apiRoute('/ratings$'), (route) => {
    const body = route.request().postDataJSON() as {
      score: number;
      comment?: string;
    };
    state.posted.push(body);
    const createdAt = new Date().toISOString();
    state.application = {
      ...state.application,
      canRate: false,
      rating: { score: body.score, comment: body.comment ?? null, createdAt },
      executor: {
        ...state.application.executor,
        rating: { average: 4.3, count: 3 },
      },
    };
    return route.fulfill(
      json(
        {
          id: 'rating-e2e-1',
          score: body.score,
          comment: body.comment ?? null,
          listingId: application.listingId,
          listingTitle: application.listing.title,
          client: { id: user.id, fullName: user.fullName },
          createdAt,
        },
        201,
      ),
    );
  });

  await page.route(apiRoute('/client-ratings$'), (route) => {
    const body = route.request().postDataJSON() as {
      score: number;
      comment?: string;
    };
    state.postedForClients.push(body);
    const createdAt = new Date().toISOString();
    state.myApplication = {
      ...state.myApplication,
      canRateClient: false,
      clientRating: {
        score: body.score,
        comment: body.comment ?? null,
        createdAt,
      },
    };
    return route.fulfill(
      json(
        {
          id: 'client-rating-e2e-1',
          score: body.score,
          comment: body.comment ?? null,
          listingId: myApplication.listingId,
          listingTitle: myApplication.listing.title,
          executor: { id: user.id, fullName: user.fullName },
          createdAt,
        },
        201,
      ),
    );
  });

  return state;
}

test('the client rates the executor of a closed job', async ({ page }) => {
  const state = await mockRatingsApi(page);

  await page.goto('/inbox?tab=received');

  const card = page.getByRole('article').filter({ hasText: 'Kenan Mehić' });
  await expect(card.getByText('4,0')).toBeVisible();
  await expect(card.getByRole('link', { name: 'Kenan Mehić' })).toHaveAttribute(
    'href',
    '/users/executor-e2e-1',
  );

  await card.getByRole('button', { name: 'Ocijeni izvođača' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ocijeni izvođača' });
  const save = dialog.getByRole('button', { name: 'Sačuvaj ocjenu' });
  // No stars chosen yet.
  await expect(save).toBeDisabled();

  await dialog.getByRole('radio', { name: /^5 od 5/ }).click();
  await dialog.getByLabel(/Komentar/).fill('  Sve uredno i na vrijeme.  ');
  await save.click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Hvala! Ocjena je sačuvana.')).toBeVisible();
  expect(state.posted).toEqual([
    {
      applicationId: application.id,
      score: 5,
      comment: 'Sve uredno i na vrijeme.',
    },
  ]);

  // The list reloads: the button is gone and the rating shows.
  await expect(card.getByText('Tvoja ocjena:')).toBeVisible();
  await expect(
    card.getByRole('button', { name: 'Ocijeni izvođača' }),
  ).toHaveCount(0);
  await expect(card.getByText('4,3')).toBeVisible();
});

test('closing the dialog sends nothing', async ({ page }) => {
  const state = await mockRatingsApi(page);

  await page.goto('/inbox?tab=received');
  await page.getByRole('button', { name: 'Ocijeni izvođača' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ocijeni izvođača' });
  await dialog.getByRole('radio', { name: /^3 od 5/ }).click();
  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  expect(state.posted).toEqual([]);
});

test('the executor rates the client of a closed job', async ({ page }) => {
  const state = await mockRatingsApi(page);

  await page.goto('/inbox?tab=applications');

  const card = page.getByRole('article').filter({ hasText: 'Montaža ormara' });
  await card.getByRole('button', { name: 'Ocijeni klijenta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ocijeni klijenta' });
  await expect(dialog.getByText('Montaža ormara')).toBeVisible();
  await expect(dialog.getByText(/javna na profilu klijenta/)).toBeVisible();

  await dialog.getByRole('radio', { name: /^4 od 5/ }).click();
  await dialog.getByLabel(/Komentar/).fill('Plaćeno odmah.');
  await dialog.getByRole('button', { name: 'Sačuvaj ocjenu' }).click();

  await expect(dialog).toBeHidden();
  expect(state.postedForClients).toEqual([
    { applicationId: myApplication.id, score: 4, comment: 'Plaćeno odmah.' },
  ]);
  expect(state.posted).toEqual([]);

  await expect(card.getByText('Tvoja ocjena klijenta:')).toBeVisible();
  await expect(
    card.getByRole('button', { name: 'Ocijeni klijenta' }),
  ).toHaveCount(0);
});
