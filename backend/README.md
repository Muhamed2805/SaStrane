# SaStrane backend

The NestJS API for SaStrane. It uses PostgreSQL through Prisma 7. For the
architecture and setup of the whole project, see the
[main README](../README.md).

## Setup

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

The API runs on <http://localhost:4000>. Routes start with `/api`, except
`GET /health`.

## Environment variables

The backend validates these at startup and refuses to start when one is
invalid. `prisma.config.ts` reads `DATABASE_URL` from `.env` for the Prisma
CLI. Variables already set in the environment win.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | | PostgreSQL URL. Use `sslmode=verify-full` for hosted databases. |
| `JWT_SECRET` | Yes | | At least 32 characters in production. |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime: a number followed by `s`, `m`, `h` or `d`. |
| `PORT` | No | `4000` | |
| `NODE_ENV` | No | `development` | `development`, `test` or `production`. |
| `CORS_ORIGINS` | In production | | Comma-separated frontend origins. |
| `TRUST_PROXY_HOPS` | No | `1` in production, else `0` | Proxies in front of the API that add to `X-Forwarded-For`. Rate limits use the client IP. See `.env.example`. |
| `RESEND_API_KEY` | In production | | When it is empty in development, email codes are printed in the terminal. |
| `EMAIL_FROM` | In production | | For example `SaStrane <noreply@your-domain.com>`. |
| `EMAIL_VERIFICATION_SECRET` | In production | | Hashes the email codes. At least 32 characters, and different from `JWT_SECRET`. |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run start:dev` | Starts the API and restarts it on changes. |
| `npm run build` | Compiles to `dist/`. |
| `npm run start:prod` | Runs `dist/main.js`. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Type-checks without emitting. |
| `npm test` | Runs the unit tests (Jest). |
| `npm run test:e2e` | Runs HTTP tests against the whole app with a mocked Prisma. |
| `npm run test:cov` | Runs the unit tests with coverage. |

## Database

The schema is in `prisma/schema.prisma` and the migrations are in
`prisma/migrations`. The Prisma Client is generated into
`src/generated/prisma`, which git ignores, so run `npx prisma generate`
after every install and every schema change.

| Task | Command |
| --- | --- |
| Apply the existing migrations | `npx prisma migrate deploy` |
| Create a migration after a schema change | `npx prisma migrate dev --name <change>` |
| Check that the database matches the migrations | `npx prisma migrate status` |
| Browse the data | `npx prisma studio` |

## API

**Auth** is a Bearer access token, from login or refresh. **Owner** means the
token's user must own the job.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | | Checks the API and the database. Returns 503 when the database does not answer. |
| `POST` | `/api/auth/register` | | Creates an account and emails a verification code. |
| `POST` | `/api/auth/verify-email` | | Confirms the code and signs in. |
| `POST` | `/api/auth/resend-verification` | | Sends a new verification code. |
| `POST` | `/api/auth/login` | | Signs in a verified account. |
| `POST` | `/api/auth/refresh` | Cookie | Rotates the refresh token and returns a new access token. |
| `POST` | `/api/auth/logout` | Cookie | Revokes the session. |
| `GET` | `/api/auth/me` | Bearer | Returns the signed-in user. |
| `POST` | `/api/auth/forgot-password` | | Emails a password reset code. |
| `POST` | `/api/auth/reset-password` | | Sets a new password and revokes all sessions. |
| `GET` | `/api/listings` | | Lists jobs. Filters: `q`, `category`, `location`, `clientId`. Paging: `page`, `limit` (max 100). |
| `GET` | `/api/listings/:id` | | Returns one job. |
| `POST` | `/api/listings` | Bearer | Creates a job. |
| `PATCH` | `/api/listings/:id` | Owner | Updates a job. |
| `DELETE` | `/api/listings/:id` | Owner | Deletes a job and its applications. |
| `POST` | `/api/applications` | Bearer | Applies to a job, once per job. |
| `GET` | `/api/applications/my` | Bearer | Lists the applications you sent. |
| `GET` | `/api/applications/my/listing-ids` | Bearer | Lists the IDs of the jobs you applied to. |
| `GET` | `/api/applications/received` | Bearer | Lists the applications to your jobs. |
| `GET` | `/api/applications/listing/:listingId` | Owner | Lists the applications to one job. |
| `PATCH` | `/api/applications/:id/status` | Owner | Accepts or rejects an application. |

**Lists.** Paged lists return
`{ items, total, page, limit, totalPages }`.

**Errors.** Errors use the standard NestJS shape. Unique conflicts return
409, and missing records return 404.

**Rate limits.** Each client IP gets 30 requests per minute. The sign-in,
sign-up and email code routes have stricter limits.
