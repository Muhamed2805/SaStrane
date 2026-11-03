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
- **Server rendering.** `/listings` fetches the first page on the server and
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
- **Metadata.** The root layout sets the title template and link previews.
  The job detail page builds its title and description from the job. Pages
  with private data are `noindex`.

## Structure

| Folder | Contents |
| --- | --- |
| `app/` | Routes: `/`, `/listings`, `/listings/[id]`, `/listings/create`, `/listings/[id]/edit`, `/inbox`, `/messages`, `/messages/[id]`, `/users/[id]`, `/profile`, `/login` |
| `features/auth/` | The session: an in-memory access token, refresh on reload and on 401, and tab sync |
| `features/listings/` | The job list, detail, form and API calls, and the names for the category and location codes |
| `features/applications/` | Applying and the workspace |
| `features/messages/` | Conversations, the unread count and the message thread |
| `features/ratings/` | The rating dialog, stars and the public profile's reviews |
| `features/landing/` | Home page sections |
| `components/` | Navbar, footer, auth provider and UI primitives |
| `lib/` | API and query clients, paging helpers, site metadata, generated API types, API URL, and date and price formatting |
| `e2e/` | Playwright tests |
