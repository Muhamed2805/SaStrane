<div align="center">

# SaStrane

**A local marketplace for side jobs.** People post small jobs such as lawn
mowing, moving help or IT support, and people nearby apply to do them.

[![CI](https://github.com/Muhamed2805/SaStrane/actions/workflows/ci.yml/badge.svg)](https://github.com/Muhamed2805/SaStrane/actions/workflows/ci.yml)
![Node.js 24](https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![NestJS 12](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

</div>

![SaStrane home page](docs/screenshots/home.png)

The interface is in Bosnian. The screenshots use the demo data from the
seed. Its photos are public domain (CC0), listed in
[`backend/prisma/seed-photos/SOURCES.md`](backend/prisma/seed-photos/SOURCES.md).

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Testing and CI](#testing-and-ci)
- [Roadmap](#roadmap)

## Features

A **client** posts a job. An **executor** applies to do it. One account can
be both.

**Jobs**
- Browse open jobs with text search and category and location filters.
  The search, filters and page are part of the URL, so a shared link or a
  reload shows the same results.
- Post, edit and delete your own jobs with a title, category, location,
  budget and description. Prices are whole KM, or agreed later.
- Add up to five photos to a job. The first is the cover on job cards, and
  the job page shows them all. Each photo is resized and saved as WebP,
  without the camera's location data.
- Close a job to stop new applications, and reopen it at any time.
- Save jobs from a job card or the job page, and find them later under
  Saved in the workspace.

**Applications**
- Apply to a job with a message and an optional price offer. You can apply
  to each job once.
- The client sees every application to their jobs and accepts or rejects
  it. The decision is final, and the client sees the executor's email only
  after accepting.
- The executor gets an email when their application is accepted or
  rejected.
- A workspace shows your jobs, the applications you sent, the ones you
  received, each with its status, and the jobs you saved.

**Messages**
- An executor can message the client of an open job, before or after
  applying. The client can message anyone who applied to their job.
- Each job has one conversation per executor. It stays open after the job
  closes, but a closed job takes no new conversations.
- The navbar shows the number of unread messages. Open conversations check
  for new messages every few seconds.
- Messages left unread for 10 minutes trigger one email per conversation,
  until the user reads it.

**Ratings**
- After closing a job, the client rates the accepted executor with 1 to 5
  stars and an optional comment. Each job's executor is rated once, and
  the rating is final.
- Every user has a public profile with a photo, a short introduction, the
  kinds of jobs they do, their average rating and the reviews. Application cards show the executor's rating and link to it.
- A rating stays on the profile when the job is deleted.

**Accounts**
- Sign up as a client, an executor or both, then confirm the email address
  with a 6-digit code.
- Reset a forgotten password with an emailed code. This signs out every
  existing session.
- A sign-in survives page reloads, and signing out in one tab signs out the
  others.
- Email notices for a new application, a decision on an application and
  unread messages. They can be turned off in the account settings.
- Account settings: add a profile photo, change the name, the role, the
  introduction and the kinds of jobs, or change the password
  with the current one. A password change signs out the other devices and
  sends a notice by email.
- Delete the account with the password. This also deletes the user's jobs
  and their photos, applications, conversations and ratings.

**Moderation**
- Report a job or a user with a reason and an optional description. Only
  admins see who sent the report.
- Admins handle the reports on their own page: mark them resolved or
  dismissed, delete the job, or suspend the account. A suspended account is
  signed out, its open jobs close, and it cannot sign in until an admin
  lifts the suspension.

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/listings.png" alt="Job list with search, filters and cover photos">
      <p align="center"><sub><b>Find a job</b>: search, filters and cover photos</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/listing-detail.png" alt="Job detail page with a photo gallery">
      <p align="center"><sub><b>Job detail</b>: photo gallery, budget and client</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/create-listing.png" alt="Form for a new job with a photo">
      <p align="center"><sub><b>Post a job</b>: up to five photos, the first is the cover</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/inbox.png" alt="Workspace with received applications">
      <p align="center"><sub><b>Workspace</b>: received applications and their status</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/messages.png" alt="Conversation between a client and an executor">
      <p align="center"><sub><b>Messages</b>: one conversation per job and executor</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/user-profile.png" alt="Public profile with ratings">
      <p align="center"><sub><b>Public profile</b>: ratings from clients</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/sign-up.png" alt="Sign-up dialog with role choice">
      <p align="center"><sub><b>Sign up</b>: choose to post jobs, do jobs or both</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/profile.png" alt="Profile page with activity counts">
      <p align="center"><sub><b>Profile</b>: activity at a glance</sub></p>
    </td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile-listings.png" alt="Job list on a phone" width="280">
  <br>
  <sub><b>On a phone</b></sub>
</p>

## Architecture

```mermaid
flowchart LR
  browser(["Browser"])

  subgraph web["Frontend: Next.js 16"]
    pages["App Router pages"]
    proxy["Rewrite /api/*"]
  end

  subgraph api["Backend: NestJS 12"]
    edge["Helmet, CORS, rate limits,<br/>validation, JWT guard"]
    modules["Auth, Listings, Applications,<br/>Messages, Ratings"]
    orm["Prisma 7<br/>pg driver adapter"]
  end

  db[("PostgreSQL")]
  storage[("S3 storage")]
  resend["Resend"]

  browser -- "pages" --> pages
  browser -- "API calls" --> proxy
  proxy --> edge
  pages -- "server-side fetch<br/>(job list, job detail)" --> edge
  edge --> modules --> orm --> db
  modules -- "email codes and notices" --> resend
  modules -- "job photos" --> storage
  browser -- "photos" --> storage
```

- **Same-origin API.** The browser calls `/api/*` on the frontend's own
  origin, and Next.js forwards it to the backend. The refresh cookie is then
  first-party, so it can use `SameSite=Strict`, and the browser needs no CORS.
- **Server rendering.** The job list and job detail pages fetch their data
  on the server, straight from `BACKEND_URL`. The job list passes its
  results to the browser's query cache, so they show without a loading
  state or a second request. Each page has its own title, description and
  link preview.
- **Client data.** TanStack Query caches API data in the browser. A change,
  such as a new application, updates the cache at once and reloads the
  lists it affects. Signing out clears the user's data from the cache.
- **Photos.** The backend checks and resizes each upload, then saves a
  large and a small WebP version in S3-compatible storage. Browsers load
  them straight from the bucket's public address, not through the API.
- **Health check.** `GET /health` checks the database too, and returns 503
  when it does not answer.
- **Typed API contract.** The backend writes `backend/openapi.json` from its
  controllers and DTOs, and the frontend generates its API types from that
  file. The backend end-to-end tests check every response against it, and
  CI fails when the file or the types are out of date.

### Sign-in and sessions

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser tab
  participant A as API (via /api proxy)
  participant D as PostgreSQL

  B->>A: POST /api/auth/login
  A->>D: Check password, create session and refresh token
  A-->>B: Access token in the body, refresh token in an httpOnly cookie
  Note over B: The access token stays in memory only

  B->>A: GET /api/applications/received with the Bearer token
  A->>D: Is the session still active?
  A-->>B: 200

  Note over B,A: The access token expires after 15 minutes, or the page reloads
  B->>A: POST /api/auth/refresh with the cookie
  A->>D: Mark the old token as used, store a new one
  A-->>B: New access token and new cookie
```

- **Refresh cookie.** It is `httpOnly`, `SameSite=Strict` and sent only to
  `/api/auth`. The database stores only a SHA-256 hash of the token.
- **Rotation.** Every refresh issues a new token. The old token still works
  for 30 seconds, for requests that were already on their way. After that,
  an old token means someone copied it, so the whole session is revoked.
- **Session limits.** A refresh token expires after 30 days without use, and
  a session after 90 days in total.
- **Revocation.** The API checks the session on every request, so logging
  out or resetting the password locks out existing access tokens at once.
- **Tabs.** Tabs share one refresh through a Web Lock and announce sign-out
  over a `BroadcastChannel`.

### Data model

```mermaid
erDiagram
  User ||--o{ Listing : posts
  User ||--o{ Application : sends
  Listing ||--o{ Application : receives
  User ||--o{ Session : "signs in with"
  Session ||--o{ RefreshToken : rotates
  Listing ||--o{ Conversation : "is discussed in"
  User ||--o{ Conversation : "takes part in"
  Conversation ||--o{ Message : holds
  Application ||--o| Rating : "is rated by"
  User ||--o{ Rating : receives
  Listing ||--o{ ListingPhoto : shows
  User ||--o{ SavedListing : saves
  Listing ||--o{ SavedListing : "is saved in"
  User ||--o{ Report : "sends or receives"
  Listing |o--o{ Report : "is reported in"

  User {
    string id PK
    string email UK
    string fullName
    UserRole role "CLIENT, EXECUTOR or BOTH"
    datetime emailVerifiedAt
    boolean isAdmin
    datetime suspendedAt
  }
  Listing {
    string id PK
    string clientId FK
    string title
    ListingCategory category "fixed list, such as CLEANING"
    ListingLocation location "fixed list, such as SARAJEVO"
    ListingStatus status "OPEN or CLOSED"
    int budget "whole KM, null when agreed later"
  }
  Application {
    string id PK
    string listingId FK "unique with executorId"
    string executorId FK
    string message
    int proposedPrice "whole KM, null when agreed later"
    ApplicationStatus status "PENDING, ACCEPTED or REJECTED"
  }
  Session {
    string id PK
    string userId FK
    datetime expiresAt
    datetime revokedAt
    SessionRevocationReason revokedReason
  }
  RefreshToken {
    string id PK
    string sessionId FK
    string tokenHash UK
    datetime rotatedAt
  }
  Conversation {
    string id PK
    string listingId FK "unique with executorId"
    string clientId FK
    string executorId FK
    datetime lastMessageAt
    int clientUnread
    int executorUnread
  }
  Message {
    string id PK
    string conversationId FK
    string senderId FK
    string body "up to 2000 characters"
  }
  Rating {
    string id PK
    string applicationId FK "unique, null after the job is deleted"
    string listingId FK "null after the job is deleted"
    string listingTitle "kept from the job"
    string clientId FK
    string executorId FK
    int score "1 to 5"
    string comment "up to 1000 characters"
  }
  ListingPhoto {
    string id PK "also names the files in storage"
    string listingId FK
    int position "the lowest is the cover"
    int width
    int height
  }
  SavedListing {
    string userId PK "with listingId"
    string listingId PK
    datetime createdAt "orders the saved list"
  }
  Report {
    string id PK
    string reporterId FK
    string reportedUserId FK "the job's client for a job report"
    string listingId FK "null for a user report or a deleted job"
    string listingTitle "kept from the job"
    ReportReason reason "SPAM, SCAM, INAPPROPRIATE or OTHER"
    ReportStatus status "OPEN, RESOLVED or DISMISSED"
    string handledById FK
  }
```

## Tech stack

| Part | Tools |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui on Radix, TanStack Query, Zustand |
| Backend | NestJS 12 on native ES modules, Passport JWT, class-validator, Helmet, `@nestjs/throttler` |
| Database | PostgreSQL, Prisma 7 with the `pg` driver adapter |
| Email | Resend |
| Photos | Any S3-compatible storage, such as Cloudflare R2, with the AWS SDK; SeaweedFS locally; sharp for resizing |
| Tests | Vitest and Supertest (backend), Vitest and Playwright (frontend) |
| CI | GitHub Actions, Dependabot |

## Project structure

```text
SaStrane/
├── backend/                 NestJS API
│   ├── prisma/              Schema, migrations and demo seed
│   ├── scripts/             Creates the photo bucket, sets admins
│   ├── src/
│   │   ├── auth/            Sign-up, email codes, sessions, JWT
│   │   ├── email/           Transactional emails through Resend
│   │   ├── listings/        Jobs and their photos
│   │   ├── storage/         S3 photo storage
│   │   ├── applications/    Applications to jobs
│   │   ├── conversations/   Messages between clients and executors
│   │   ├── ratings/         Ratings and public user profiles
│   │   ├── moderation/      Reports and the admin routes
│   │   ├── common/          Error filters and transforms
│   │   ├── config/          Environment validation, CORS
│   │   ├── openapi/         Generates the API contract
│   │   └── prisma/          Database client
│   ├── test/                End-to-end tests on PostgreSQL
│   └── openapi.json         The API contract
├── frontend/                Next.js app
│   ├── app/                 Routes
│   ├── features/            Auth, listings, applications, messages, ratings, moderation, landing
│   ├── components/          Shared UI
│   ├── lib/                 API and query clients, generated API types, formatting
│   └── e2e/                 Playwright tests
├── docker/                  Local storage settings
├── docs/screenshots/
└── docker-compose.yml       Local PostgreSQL and photo storage
```

## Getting started

You need [Node.js 24](.nvmrc) with npm 11, and Docker for the local
database and photo storage.

**1. Database and storage.** From the repository root, start PostgreSQL 17
on `localhost:5432` and SeaweedFS, an S3-compatible storage, on
`localhost:8333`:

```bash
docker compose up -d
```

Set `POSTGRES_PORT` or `STORAGE_PORT` when a port is taken, and change the
URLs in `backend/.env` to match. A hosted database such as
[Neon](https://neon.tech) works too: put its URL in `backend/.env`.

**2. Backend.** It runs on <http://localhost:4000>.

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run storage:init
npx prisma db seed
npm run start:dev
```

The example `.env` works with the Docker containers as it is.
`npm run storage:init` creates the photo bucket. The seed adds
demo users, jobs with photos, applications, ratings, messages and a
report. Sign in as `amra@example.com` with the password
`demo-password-123`, or as `admin@example.com` to see the admin page. Email codes for new accounts are printed in
the backend terminal while `RESEND_API_KEY` is empty.

**3. Frontend.** It runs on <http://localhost:3000>.

```bash
cd frontend
npm install
npm run dev
```

The frontend forwards `/api/*` to `BACKEND_URL`, which defaults to
`http://localhost:4000`. Set it before `npm run dev` or `npm run build`,
because the build fixes the value.

More details: [backend/README.md](backend/README.md) covers the environment
variables, the API and migrations. [frontend/README.md](frontend/README.md)
covers the frontend scripts and tests.

## Testing and CI

| | Backend | Frontend |
| --- | --- | --- |
| Lint and types | `npm run lint`, `npm run typecheck` | `npm run lint`, `npm run typecheck` |
| Unit tests | `npm test` (Vitest) | `npm test` (Vitest) |
| End-to-end | `npm run test:e2e` (Supertest, real PostgreSQL) | `npm run test:e2e` (Playwright, mocked API) |
| Build | `npm run build` | `npm run build` |
| API contract | `npm run openapi` | `npm run api:types` |

After a change to a controller or a DTO, run `npm run openapi` in `backend/`
and then `npm run api:types` in `frontend/`, and commit both files.

The backend end-to-end tests need the Docker database. They create their
own `sastrane_test` database, apply the migrations and empty every table
before each test, so they never touch your development data.

GitHub Actions runs all of these for both apps on pushes and pull requests
to `main`. The backend job also runs PostgreSQL. It applies the migrations,
checks that they match `schema.prisma` and runs the seed. Both jobs check
that the API contract and the frontend types are up to date. Every Monday,
Dependabot opens update PRs, grouped so that related packages move together.

## Roadmap

- **Dependency upgrades:** TypeScript 7, once `@nestjs/swagger` and
  typescript-eslint support it.

The app is in development and not deployed yet.
