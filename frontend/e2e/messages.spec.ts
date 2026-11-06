import { expect, test, type Page } from '@playwright/test';

// Browsers call the API through the app's own /api proxy.
const API = /^https?:\/\/[^/]+\/api/;
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';

const user = {
  id: 'user-e2e-1',
  email: 'korisnik@example.com',
  fullName: 'Test Korisnik',
  role: 'BOTH',
  createdAt: '2026-09-15T12:00:00.000Z',
};

const AVATAR_URL = 'https://photos.test/avatars/client-e2e-1/avatar-1.webp';
// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/mZtZ4wAAAABJRU5ErkJggg==',
  'base64',
);

const firstMessage = {
  id: 'message-1',
  senderId: 'client-e2e-1',
  body: 'Može li sutra oko 15h?',
  createdAt: new Date().toISOString(),
};

const conversation = {
  id: 'conversation-e2e-1',
  listing: { id: 'listing-e2e-1', title: 'Košenje dvorišta', status: 'OPEN' },
  role: 'EXECUTOR',
  otherUser: {
    id: 'client-e2e-1',
    fullName: 'Amra Hodžić',
    avatarUrl: AVATAR_URL,
  },
  lastMessage: firstMessage,
  unreadCount: 1,
  createdAt: '2026-11-01T10:00:00.000Z',
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

// A signed-in user with one conversation and one unread message.
async function mockMessagesApi(page: Page) {
  const state = {
    messages: [firstMessage],
    unread: 1,
    sent: [] as string[],
    reads: 0,
  };

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, SIGNED_IN_HINT_KEY);
  await page.route(apiRoute('/auth/refresh$'), (route) =>
    route.fulfill(json({ user, accessToken: 'access-token' })),
  );
  await page.route(apiRoute('/conversations/unread-count$'), (route) =>
    route.fulfill(json({ count: state.unread })),
  );
  await page.route(AVATAR_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route(apiRoute('/conversations\\?'), (route) =>
    route.fulfill(
      json({
        items: [
          {
            ...conversation,
            lastMessage: state.messages.at(-1),
            unreadCount: state.unread,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    ),
  );
  await page.route(apiRoute(`/conversations/${conversation.id}$`), (route) =>
    route.fulfill(json({ ...conversation, unreadCount: state.unread })),
  );
  await page.route(
    apiRoute(`/conversations/${conversation.id}/messages`),
    (route) => {
      if (route.request().method() === 'POST') {
        const { body } = route.request().postDataJSON() as { body: string };
        state.sent.push(body);
        const message = {
          id: `message-${state.messages.length + 1}`,
          senderId: user.id,
          body,
          createdAt: new Date().toISOString(),
        };
        state.messages.push(message);
        return route.fulfill(json(message, 201));
      }
      return route.fulfill(
        json({ items: [...state.messages].reverse(), nextCursor: null }),
      );
    },
  );
  await page.route(
    apiRoute(`/conversations/${conversation.id}/read$`),
    (route) => {
      state.reads += 1;
      state.unread = 0;
      return route.fulfill({ status: 204 });
    },
  );

  return state;
}

test('shows the unread count and marks a conversation as read when opened', async ({
  page,
}) => {
  const state = await mockMessagesApi(page);

  await page.goto('/messages');

  const messagesLink = page
    .getByRole('banner')
    .getByRole('link', { name: /Poruke/ });
  await expect(messagesLink).toContainText('1');
  const row = page
    .getByRole('navigation', { name: 'Razgovori' })
    .getByRole('link', { name: /Amra Hodžić/ });
  await expect(row).toContainText('Košenje dvorišta');
  await expect(row).toContainText(firstMessage.body);
  await expect(row.locator('img')).toHaveAttribute('src', AVATAR_URL);

  await row.click();

  // The dev server compiles the conversation route on its first visit.
  await expect(page).toHaveURL(new RegExp(`/messages/${conversation.id}$`), {
    timeout: 20_000,
  });
  await expect(
    page.getByRole('heading', { name: 'Amra Hodžić' }),
  ).toBeVisible();
  await expect(page.getByText(firstMessage.body).last()).toBeVisible();
  // The thread header shows the photo too, next to the list.
  await expect(page.locator(`img[src="${AVATAR_URL}"]`)).toHaveCount(2);
  await expect.poll(() => state.reads).toBe(1);
  await expect(messagesLink).not.toContainText('1');
});

test('sends a message with Enter and keeps Shift+Enter for new lines', async ({
  page,
}) => {
  const state = await mockMessagesApi(page);
  await page.goto(`/messages/${conversation.id}`);
  const input = page.getByLabel('Poruka', { exact: true });

  await input.fill('Može, vidimo se');
  await input.press('Shift+Enter');
  await input.pressSequentially('u 15h.');
  await input.press('Enter');

  await expect.poll(() => state.sent).toEqual(['Može, vidimo se\nu 15h.']);
  await expect(input).toHaveValue('');
  // The bubble keeps the line break; the list shows the same text too.
  await expect(
    page.getByText('Može, vidimo se u 15h.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Pošalji poruku' }),
  ).toBeDisabled();
});

test('asks a signed-out visitor to sign in', async ({ page }) => {
  await page.goto('/messages');

  await expect(
    page.getByRole('heading', { name: 'Prijavi se za nastavak' }),
  ).toBeVisible();
});
