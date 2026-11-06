# SaStrane backend

The NestJS API for SaStrane. It uses PostgreSQL through Prisma 7. For the
architecture and setup of the whole project, see the
[main README](../README.md).

## Setup

Start the database and the photo storage first with `docker compose up -d`
in the repository root. Then run:

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run storage:init
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
| `APP_URL` | In production | `http://localhost:3000` | The web app's public address, used for links in emails. |
| `TRUST_PROXY_HOPS` | No | `1` in production, else `0` | Proxies in front of the API that add to `X-Forwarded-For`. Rate limits use the client IP. See `.env.example`. |
| `RESEND_API_KEY` | In production | | When it is empty in development, the backend prints email codes and notices in the terminal instead of sending them. |
| `EMAIL_FROM` | In production | | For example `SaStrane <noreply@your-domain.com>`. |
| `EMAIL_VERIFICATION_SECRET` | In production | | Hashes the email codes. At least 32 characters, and different from `JWT_SECRET`. |
| `S3_ENDPOINT` | No | `http://localhost:8333` | The S3 API of the photo storage. Leave it empty for AWS S3. For Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`. |
| `S3_REGION` | No | `us-east-1`, or `auto` in production | `auto` for R2. |
| `S3_BUCKET` | In production | `sastrane-photos` | |
| `S3_ACCESS_KEY_ID` | In production | The SeaweedFS key | |
| `S3_SECRET_ACCESS_KEY` | In production | The SeaweedFS secret | |
| `S3_FORCE_PATH_STYLE` | No | `true`, or `false` in production | `true` puts the bucket in the URL path (SeaweedFS, MinIO), `false` in the host name (AWS S3). |
| `S3_PUBLIC_URL` | In production | `http://localhost:8333/sastrane-photos` | Where browsers load the photos: the bucket's public address, such as an R2 custom domain. The bucket must allow anonymous reads. |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run start:dev` | Starts the API and restarts it on changes. |
| `npm run build` | Compiles to `dist/`. |
| `npm run start:prod` | Runs `dist/main.js`. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Type-checks without emitting. |
| `npm test` | Runs the unit tests (Vitest). |
| `npm run test:e2e` | Runs HTTP tests against the whole app and a real PostgreSQL. |
| `npm run test:cov` | Runs the unit tests with coverage. |
| `npm run openapi` | Builds the app and writes the API contract to `openapi.json`. |
| `npm run storage:init` | Creates the photo bucket when it is missing. |

## ES modules

The backend is native ES modules (`"type": "module"`), as NestJS 12 is.

- Relative imports end in `.js`, also when the source file is `.ts`, for
  example `import { AppModule } from './app.module.js'`.
- Use `import.meta.dirname` instead of `__dirname`.
- Prisma generates its client as ES modules too (`moduleFormat = "esm"` in
  `schema.prisma`).
- The tests run on Vitest. SWC compiles them through `unplugin-swc`, because
  Nest needs the decorator metadata that Vitest's default transform does not
  emit. The settings are in `vitest.config.ts`.

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
| Start over with an empty database | `docker compose down -v`, then `docker compose up -d`, migrate again and run `npm run storage:init` |

The seed in `prisma/seed.ts` adds four users, two of them with an
introduction and skills, ten jobs, seven photos, seven applications, two ratings and three conversations. The photos come from
`prisma/seed-photos` and need the storage container and
`npm run storage:init`. When the storage is not reachable, as in CI, the
seed skips them with a warning. Every demo user signs in with
`demo-password-123`, for example as `amra@example.com`. The seed only adds missing rows, so it is safe to run
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

The e2e files share one database, so they run one after another.

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
token's user must own the job. **Member** means the user must be one of the
two sides of the conversation.

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
| `PATCH` | `/api/auth/me` | Bearer | Changes the user's name, role, `bio`, `skills` or `emailNotifications`. |
| `PUT` | `/api/auth/me/avatar` | Bearer | Sets the profile photo: `multipart/form-data` with the file in `photo`. |
| `DELETE` | `/api/auth/me/avatar` | Bearer | Removes the profile photo. |
| `POST` | `/api/auth/change-password` | Bearer | Checks the current password, sets a new one and revokes the other sessions. Returns 204. |
| `DELETE` | `/api/auth/me` | Bearer | Checks the password and deletes the account with its jobs, photos, applications, conversations and ratings. Returns 204. |
| `POST` | `/api/auth/forgot-password` | | Emails a password reset code. |
| `POST` | `/api/auth/reset-password` | | Sets a new password and revokes all sessions. |
| `GET` | `/api/listings` | | Lists jobs. Filters: `q` (title and description), `category`, `location`, `status`, `clientId`. Paging: `page`, `limit` (max 100). |
| `GET` | `/api/listings/:id` | | Returns one job. |
| `POST` | `/api/listings` | Bearer | Creates a job and returns it like `GET /api/listings/:id`. |
| `PATCH` | `/api/listings/:id` | Owner | Updates a job. |
| `PATCH` | `/api/listings/:id/status` | Owner | Opens or closes a job. |
| `DELETE` | `/api/listings/:id` | Owner | Deletes a job with its applications and photos. Returns 204. |
| `POST` | `/api/listings/:id/photos` | Owner | Adds a photo: `multipart/form-data` with the file in `photo`. |
| `PUT` | `/api/listings/:id/photos/order` | Owner | Sets the order of the photos. The first is the cover. |
| `DELETE` | `/api/listings/:id/photos/:photoId` | Owner | Deletes a photo. Returns 204. |
| `POST` | `/api/applications` | Bearer | Applies to a job, once per job. |
| `GET` | `/api/applications/my` | Bearer | Lists the applications you sent. |
| `GET` | `/api/applications/my/listing-ids` | Bearer | Lists the IDs of the jobs you applied to. |
| `GET` | `/api/applications/received` | Bearer | Lists the applications to your jobs. |
| `GET` | `/api/applications/listing/:listingId` | Owner | Lists the applications to one job. |
| `PATCH` | `/api/applications/:id/status` | Owner | Accepts or rejects an application. |
| `POST` | `/api/conversations` | Bearer | Returns the conversation about a job, and creates it the first time. |
| `GET` | `/api/conversations` | Bearer | Lists your conversations, the latest message first. |
| `GET` | `/api/conversations/unread-count` | Bearer | Counts your unread messages. |
| `GET` | `/api/conversations/:id` | Member | Returns one conversation. |
| `GET` | `/api/conversations/:id/messages` | Member | Lists the messages, newest first. Paging: `before` (a cursor), `limit` (max 100). |
| `POST` | `/api/conversations/:id/messages` | Member | Sends a message. |
| `POST` | `/api/conversations/:id/read` | Member | Marks the conversation as read. Returns 204. |
| `POST` | `/api/ratings` | Owner | Rates the executor of an accepted application to a closed job. |
| `GET` | `/api/users/:id` | | Returns a user's public profile: photo, introduction, skills and rating. |
| `GET` | `/api/users/:id/ratings` | | Lists the ratings a user received, newest first. Paging: `page`, `limit` (max 50). |

**Lists.** Paged lists return
`{ items, total, page, limit, totalPages }`.

**Jobs and applications.**
- Categories and locations are fixed codes, such as `CLEANING` and
  `SARAJEVO`. The frontend maps them to names.
- Prices (`budget`, `proposedPrice`) are whole KM from 1 to 100,000. `null`
  means the price is agreed later.
- Only `OPEN` jobs take applications. Applying to a closed job returns 409
  with the code `LISTING_CLOSED`. The client can still decide on the
  applications already sent.
- A decision is final. Deciding on an application that is not `PENDING`
  returns 409 with the code `APPLICATION_ALREADY_DECIDED`.
- The executor's email is `null` until the client accepts the application.
- A new application emails the job's client with the executor's name, the
  price and the message, and a link to the received applications.
- After a decision, the executor gets an email with the result and a link
  to the job. It is sent after the response. A failed email is logged, and
  the decision stays.

**Photos.**
- A job has up to five photos. A sixth returns 409 with the code
  `PHOTO_LIMIT_REACHED`.
- A photo is a JPG, PNG, WebP or AVIF file of up to 5 MB. A larger file
  returns 413, and a file that is not such an image returns 400 with the
  code `INVALID_IMAGE`. The file's name and type are not trusted: only what
  decodes is saved.
- The backend turns the photo upright, drops its EXIF data, such as the GPS
  position, and saves two WebP versions: up to 1600 pixels for `url` and up
  to 640 pixels for `thumbnailUrl`. `width` and `height` are the large
  version's size.
- Jobs return their photos in `photos`, the cover first. Lists return only
  the cover, in `coverPhoto`, which is `null` when a job has no photos.
- The files are stored under `listings/<job id>/<photo id>.webp`, and never
  change. They are served with a one-year cache lifetime.
- The files are deleted after their row. When that fails, the API logs it
  and the files stay unused in the bucket.
- When the storage is down, an upload returns 503.

**Conversations.**
- There is one conversation per job and user, between the job's client and
  a user who asks about the job or applied to it. Emails stay private.
- Any signed-in user can write to the client of an `OPEN` job. The client
  writes to a user who applied by passing `executorId`, also after closing
  the job. Starting a new conversation about a closed job returns 409 with
  the code `LISTING_CLOSED`. Existing conversations go on after closing.
- A conversation without messages is not listed. Deleting the job deletes
  its conversations.
- The site checks for new messages every few seconds, so the conversation
  routes allow 120 requests per minute. Sending allows 20.
- Once a minute the API looks for messages that have been unread for 10
  minutes and emails the recipient, with the count and the last message.
  Each side of a conversation gets one email until it reads the
  conversation, by opening it or by answering. The conversation is marked
  before the email is sent, so two API instances cannot send it twice. A
  failed email is logged and not retried.

**Ratings.**
- The client rates the executor of an accepted application with 1 to 5
  stars and an optional comment of up to 1000 characters. The job must be
  closed first: otherwise the route returns 409 with the code
  `LISTING_NOT_CLOSED`, or `APPLICATION_NOT_ACCEPTED` when the application
  is not accepted.
- There is one rating per application, and it is final. A second one
  returns 409 with the code `ALREADY_RATED`.
- A rating outlives its job. Deleting the job clears `listingId`, and
  `listingTitle` keeps the job's title.
- Application lists show the executor's average and count. The client's
  lists also have `canRate`, which is true when the executor can be rated.
- Profiles under `/api/users` are public. They show the name, the profile
  photo, the introduction, the skills, the sign-up date and the ratings,
  never the email.

**Account.**
- The email address cannot be changed. `PATCH /api/auth/me` changes only
  `fullName`, `role`, `bio`, `skills` and `emailNotifications`. Access
  tokens issued earlier keep the old role until they expire, but no route
  reads it from the token.
- `bio` is a short introduction of up to 500 characters. An empty one
  removes it. `skills` lists the job categories the user does, each once.
- `emailNotifications` turns off the emails about new applications,
  decisions and unread messages. Security emails, such as codes and the
  password change notice, are always sent.
- The profile photo follows the rules for job photos: JPG, PNG, WebP or
  AVIF, up to 5 MB, with the same 400 and 413 errors. The backend cuts a
  square of 256 pixels around the most detailed part, usually the face, and
  drops the EXIF data. `avatarUrl` is `null` without a photo.
- Each upload is a new file under `avatars/<user id>/<avatar id>.webp`, so
  it can be cached for a year. The previous file is deleted after the row
  points to the new one.
- Changing the password and deleting the account need the current
  password. A wrong one returns 400 with the code `WRONG_PASSWORD`, not
  401, so the client stays signed in. Both routes allow 5 requests per
  minute.
- A password change keeps the session that asked and revokes the others.
  The user gets an email notice after the response. A failed email is
  logged, and the change stays.
- Deleting the account clears the refresh cookie. It also deletes the
  user's jobs with their photos, the profile photo, the applications on
  both sides, every conversation the user is part of and the ratings given
  or received.
  Other users lose those conversations and ratings too.

**Errors.** Errors use the standard NestJS shape,
`{ statusCode, message, error }`. Errors that the frontend must tell apart
return `{ code, message }` instead, such as `EMAIL_NOT_VERIFIED` on login.
`openapi.json` lists the codes and the error statuses of every route. Unique
conflicts return
409, and missing records return 404. When the database cannot be reached,
routes that need it return 503.

**Rate limits.** Each client IP gets 30 requests per minute on each route.
The sign-in, sign-up and email code routes have stricter limits, and the
conversation routes higher ones.
