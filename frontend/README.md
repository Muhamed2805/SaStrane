# SaStrane frontend

The Next.js 16 app for SaStrane, built with React 19, Tailwind CSS 4 and
shadcn/ui. For the architecture and setup of the whole project, see the
[main README](../README.md).

## Setup

Start the [backend](../backend/README.md) first, then run:

```bash
npm install
npm run dev
```

The app runs on <http://localhost:3000>.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `BACKEND_URL` | `http://localhost:4000` | The backend origin. Browsers reach it through the `/api/*` rewrite, and server rendering calls it directly. The build fixes the rewrite, so set it before `npm run dev` or `npm run build`. |
| `SITE_URL` | `http://localhost:3000` | The public address of the site. Canonical links and link previews use it. Set it before `npm run build`. |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the development server. |
| `npm run build` | Builds for production. |
| `npm start` | Serves the production build. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Type-checks without emitting. |
| `npm test` | Runs the unit tests (Vitest). |
| `npm run test:e2e` | Runs the Playwright tests in Chromium. They start a dev server and mock the API. |
| `npm run test:e2e:ui` | Opens the Playwright test UI. |
| `npm run api:types` | Generates `lib/api-schema.d.ts` from `../backend/openapi.json`. |

Before the first `test:e2e`, run `npx playwright install chromium`.

## API types

The request and response types come from the backend's `openapi.json`.
`npm run api:types` writes them to `lib/api-schema.d.ts`, and each
`features/*/api.ts` file names the ones it uses, such as `Listing` or
`MyApplication`. Do not edit the generated file. After the backend contract
changes, run the script and commit the result. CI fails when the file is out
of date.

## Data

[TanStack Query](https://tanstack.com/query) holds the data from the API.

- **Query options.** `features/*/queries.ts` define the query keys and
  options. The signed-in user's data is under `['user', userId, ...]`, and
  signing out or switching users removes it.
- **Server rendering.** `/listings` and `/executors` fetch the first page on the server and
  passes it to the browser cache with `HydrationBoundary`. The job detail
  page stores its job in the cache too, for the apply dialog and the edit
  page. The public profile `/users/[id]` fetches the profile and the first
  page of reviews on the server. Profiles are public, so their keys are
  `['users', userId]` and are not removed on sign-out. The server does not
  retry failed requests: the browser fetches what is missing.
- **Changes.** A change stores the API's answer in the cache, then reloads
  the lists it affects. Client errors (4xx) are not retried.
- **URL filters.** The job list reads its search, filters and page from the
  URL with `features/listings/search-params.ts`, on the server and in the
  browser alike. Changes go to the URL with the History API, so they need no
  server round trip. Typing replaces the history entry, other changes add
  one, so Back steps through filters, not keystrokes.
- **Photos.** The browser loads job photos straight from the storage's
  public address. The backend already resizes them, so `next/image` shows
  them with `unoptimized` and needs no allowed hosts. A new job's photos are
  uploaded after the job is created. On the edit page, each photo change is
  saved at once.
- **Metadata.** The root layout sets the title template and link previews.
  The job detail page builds its title and description from the job. Pages
  with private data are `noindex`.

## Structure

| Folder | Contents |
| --- | --- |
| `app/` | Routes: `/`, `/listings`, `/listings/[id]`, `/listings/create`, `/listings/[id]/edit`, `/executors`, `/inbox`, `/messages`, `/messages/[id]`, `/users/[id]`, `/profile`, `/settings`, `/admin` with `reports`, `users` and `listings`, `/login` |
| `features/auth/` | The session: an in-memory access token, refresh on reload and on 401, and tab sync |
| `features/account/` | Account settings: profile photo, name, role, introduction, skills and location, email notifications, password change and account deletion |
| `features/listings/` | The job list, detail, form, photos and API calls, the names for the category and location codes, and the expiry with its extend button |
| `features/applications/` | Applying and the workspace |
| `features/messages/` | Conversations, the unread count and the message thread |
| `features/ratings/` | The rating dialogs for executors and clients, stars and the public profile's reviews |
| `features/executors/` | The executor list with its search and filters |
| `features/invitations/` | The invite dialog on a profile and the invitations in the workspace |
| `features/job-alerts/` | The alert button on the job list and the alerts in the settings |
| `features/portfolio/` | The gallery of work: its editor in the settings and the photos on a profile |
| `features/notifications/` | The bell in the navbar with the unread count and the notifications |
| `features/live/` | The event stream (`GET /api/live`): keeps it open while a user is signed in and loads again what the server says has changed: messages, the unread counts, the bell and, after a notification, the workspace lists and the user's own profile. While it is open, polling slows to once a minute |
| `features/moderation/` | The report button and dialog, and the admin pages: overview, reports, users and jobs |
| `features/landing/` | Home page sections |
| `components/` | Navbar, footer, auth provider and UI primitives |
| `lib/` | API and query clients, paging helpers, site metadata, generated API types, API URL, the Content-Security-Policy, and date and price formatting |
| `proxy.ts` | Gives every page a Content-Security-Policy with a nonce per request. Scripts run only with that nonce, so every page is rendered per request (`connection()` in `app/layout.tsx`); nothing is prerendered. Photos may come from any HTTPS host; a script, font or API on another origin must be added in `lib/csp.ts` |
| `e2e/` | Playwright tests |
