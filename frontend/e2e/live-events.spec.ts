import { expect, test } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'user-e2e-1',
  email: 'amra@example.com',
  fullName: 'Amra Hodžić',
  role: 'BOTH',
  emailNotifications: true,
  bio: null,
  skills: [],
  location: null,
  avatarUrl: null,
  createdAt: '2026-09-15T12:00:00.000Z',
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

const emptyPage = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };

test('shows a new message and a new notification without waiting for a poll', async ({
  page,
}) => {
  // The counts grow only after the server has said so on the stream, and
  // the stream speaks only after the page has loaded both counts once.
  let told = false;
  let countsLoaded = 0;
  let bothCountsLoaded = () => {};
  const firstCounts = new Promise<void>((resolve) => {
    bothCountsLoaded = resolve;
  });
  const count = (after: number) => {
    if (!told && (countsLoaded += 1) === 2) bothCountsLoaded();
    return json({ count: told ? after : 0 });
  };
  let streams = 0;

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(count(3)),
  );
  await page.route(apiRoute('/notifications/unread-count$'), (route) =>
    route.fulfill(count(1)),
  );
  // What the workspace asked for again after the stream spoke.
  const reloaded = new Set<string>();
  await page.route(
    apiRoute('/(listings|applications|invitations)'),
    (route) => {
      if (told) reloaded.add(new URL(route.request().url()).pathname);
      return route.fulfill(json(emptyPage));
    },
  );
  await page.route(apiRoute('/live$'), async (route) => {
    streams += 1;
    // Only the first stream opens. The page keeps trying the others.
    if (streams > 1) return route.fulfill(json({ message: 'Down' }, 503));

    expect(route.request().headers().authorization).toBe('Bearer access-token');
    await firstCounts;
    told = true;
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body:
        'id: 1\ndata: {"type":"ready"}\n\n' +
        'id: 2\ndata: {"type":"message","conversationId":"conversation-1"}\n\n' +
        'id: 3\ndata: {"type":"notification"}\n\n',
    });
  });

  await page.goto('/inbox?tab=invitations');

  // Without the stream, the counts are asked again only after 30 seconds.
  await expect(
    page.getByRole('link', { name: 'Poruke 3 nepročitanih' }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole('button', { name: 'Obavijesti, 1 nepročitanih' }),
  ).toBeVisible();

  // A notification is about something the workspace lists.
  await expect
    .poll(() => [...reloaded].sort())
    .toEqual(
      expect.arrayContaining([
        '/api/applications/my',
        '/api/applications/received',
        '/api/invitations',
        '/api/listings',
      ]),
    );
});
