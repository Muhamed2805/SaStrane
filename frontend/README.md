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

Before the first `test:e2e`, run `npx playwright install chromium`.

## Structure

| Folder | Contents |
| --- | --- |
| `app/` | Routes: `/`, `/listings`, `/listings/[id]`, `/listings/create`, `/listings/[id]/edit`, `/inbox`, `/profile`, `/login` |
| `features/auth/` | The session: an in-memory access token, refresh on reload and on 401, and tab sync |
| `features/listings/` | The job list, detail, form and API calls |
| `features/applications/` | Applying and the workspace |
| `features/landing/` | Home page sections |
| `components/` | Navbar, footer, auth provider and UI primitives |
| `lib/` | API client, API URL and date formatting |
| `e2e/` | Playwright tests |
