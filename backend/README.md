# SaStrane backend

The NestJS API for SaStrane. It uses PostgreSQL through Prisma 7. For the
architecture and setup of the whole project, see the
[main README](../README.md).

## Setup

Start the database first with `docker compose up -d` in the repository
root. Then run:

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
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
| `DATABASE_URL` | Yes | | PostgreSQL URL. `.env.example` points at the Docker database. Add `sslmode=verify-full` for hosted databases. |
| `TEST_DATABASE_URL` | No | The Docker database's `sastrane_test` | Used only by the e2e tests. The database name must end with `_test`. |
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
| `npm run test:e2e` | Runs HTTP tests against the whole app and a real PostgreSQL. |
| `npm run test:cov` | Runs the unit tests with coverage. |
| `npm run openapi` | Builds the app and writes the API contract to `openapi.json`. |

## Database

The schema is in `prisma/schema.prisma` and the migrations are in
`prisma/migrations`. The Prisma Client is generated into
`src/generated/prisma`, which git ignores, so run `npx prisma generate`
after every install and every schema change.

| Task | Command |
| --- | --- |
| Apply the existing migrations | `npx prisma migrate deploy` |
| Add the demo data | `npx prisma db seed` |
| Create a migration after a schema change | `npx prisma migrate dev --name <change>` |
| Check that the database matches the migrations | `npx prisma migrate status` |
| Browse the data | `npx prisma studio` |
| Start over with an empty database | `docker compose down -v`, then `docker compose up -d` and migrate again |

The seed in `prisma/seed.ts` adds four users, nine jobs and six
applications. Every demo user signs in with `demo-password-123`, for example
as `amra@example.com`. The seed only adds missing rows, so it is safe to run
again, and it refuses to run with `NODE_ENV=production`.

## End-to-end tests

`npm run test:e2e` needs PostgreSQL, such as the Docker database. Before the
tests, it creates the database from `TEST_DATABASE_URL` when it is missing and
applies the migrations. Each test starts with empty tables. To protect real
data, the tests refuse a database whose name does not end with `_test`.

The tests run the app with its real configuration. Only email delivery is
replaced, so the tests can read the codes. The tests in
`test/database-down.e2e-spec.ts` point the app at a closed port and check that
it answers 503.

Jest runs with `--experimental-vm-modules`, because the Prisma 7 client loads
its query compiler with a dynamic `import()`.

## API contract

`openapi.json` describes every route, request and response. The
`@nestjs/swagger` compiler plugin reads it from the controllers and the DTOs:
the types, the validation decorators and the JSDoc comments. The response
DTOs are in the `dto/*-response.dto.ts` files.

- After a change to a controller or a DTO, run `npm run openapi` and commit
  `openapi.json`. CI fails when the file is out of date.
- The frontend generates its API types from this file with
  `npm run api:types`.
- The end-to-end tests check every response against the file. A test fails
  when a status is not documented for its route, or when a body has a field
  that is missing, has the wrong type, or is not in the contract.
- In development, the interactive docs are at
  <http://localhost:4000/api/docs> and the document at `/api/docs-json`.
  Production does not serve them.

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
| `POST` | `/api/listings` | Bearer | Creates a job and returns it like `GET /api/listings/:id`. |
| `PATCH` | `/api/listings/:id` | Owner | Updates a job. |
| `DELETE` | `/api/listings/:id` | Owner | Deletes a job and its applications. Returns 204. |
| `POST` | `/api/applications` | Bearer | Applies to a job, once per job. |
| `GET` | `/api/applications/my` | Bearer | Lists the applications you sent. |
| `GET` | `/api/applications/my/listing-ids` | Bearer | Lists the IDs of the jobs you applied to. |
| `GET` | `/api/applications/received` | Bearer | Lists the applications to your jobs. |
| `GET` | `/api/applications/listing/:listingId` | Owner | Lists the applications to one job. |
| `PATCH` | `/api/applications/:id/status` | Owner | Accepts or rejects an application. |

**Lists.** Paged lists return
`{ items, total, page, limit, totalPages }`.

**Errors.** Errors use the standard NestJS shape,
`{ statusCode, message, error }`. Errors that the frontend must tell apart
return `{ code, message }` instead, such as `EMAIL_NOT_VERIFIED` on login.
`openapi.json` lists the codes and the error statuses of every route. Unique
conflicts return
409, and missing records return 404. When the database cannot be reached,
routes that need it return 503.

**Rate limits.** Each client IP gets 30 requests per minute. The sign-in,
sign-up and email code routes have stricter limits.
