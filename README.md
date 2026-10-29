<div align="center">

# SaStrane

**A local marketplace for side jobs.** People post small jobs such as lawn
mowing, moving help or IT support, and people nearby apply to do them.

[![CI](https://github.com/Muhamed2805/SaStrane/actions/workflows/ci.yml/badge.svg)](https://github.com/Muhamed2805/SaStrane/actions/workflows/ci.yml)
![Node.js 24](https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![NestJS 11](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

</div>

![SaStrane home page](docs/screenshots/home.png)

The interface is in Bosnian. The screenshots use demo data.

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
- Post, edit and delete your own jobs with a title, category, location,
  budget and description.

**Applications**
- Apply to a job with a message and an optional price offer. You can apply
  to each job once.
- The client sees every application to their jobs and accepts or rejects it.
- A workspace shows your jobs, the applications you sent and the ones you
  received, each with its status.

**Accounts**
- Sign up as a client, an executor or both, then confirm the email address
  with a 6-digit code.
- Reset a forgotten password with an emailed code. This signs out every
  existing session.
- A sign-in survives page reloads, and signing out in one tab signs out the
  others.

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/listings.png" alt="Job list with search and filters">
      <p align="center"><sub><b>Find a job</b>: search, category and location filters</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/listing-detail.png" alt="Job detail page">
      <p align="center"><sub><b>Job detail</b>: budget, description and client</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/inbox.png" alt="Workspace with received applications">
      <p align="center"><sub><b>Workspace</b>: received applications and their status</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/create-listing.png" alt="Form for a new job">
      <p align="center"><sub><b>Post a job</b></sub></p>
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

  subgraph api["Backend: NestJS 11"]
    edge["Helmet, CORS, rate limits,<br/>validation, JWT guard"]
    modules["Auth, Listings,<br/>Applications"]
    orm["Prisma 7<br/>pg driver adapter"]
  end

  db[("PostgreSQL")]
  resend["Resend"]

  browser -- "pages" --> pages
  browser -- "API calls" --> proxy
  proxy --> edge
  pages -- "server-side fetch<br/>(job detail)" --> edge
  edge --> modules --> orm --> db
  modules -- "email codes" --> resend
```

- **Same-origin API.** The browser calls `/api/*` on the frontend's own
  origin, and Next.js forwards it to the backend. The refresh cookie is then
  first-party, so it can use `SameSite=Strict`, and the browser needs no CORS.
- **Server rendering.** The job detail page fetches its data on the server,
  straight from `BACKEND_URL`.
- **Health check.** `GET /health` checks the database too, and returns 503
  when it does not answer.

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

  User {
    string id PK
    string email UK
    string fullName
    UserRole role "CLIENT, EXECUTOR or BOTH"
    datetime emailVerifiedAt
  }
  Listing {
    string id PK
    string clientId FK
    string title
    string category
    string location
    string budget
  }
  Application {
    string id PK
    string listingId FK "unique with executorId"
    string executorId FK
    string message
    string proposedPrice
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
```

## Tech stack

| Part | Tools |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui on Radix, Zustand |
| Backend | NestJS 11, Passport JWT, class-validator, Helmet, `@nestjs/throttler` |
| Database | PostgreSQL, Prisma 7 with the `pg` driver adapter |
| Email | Resend |
| Tests | Jest and Supertest (backend), Vitest and Playwright (frontend) |
| CI | GitHub Actions, Dependabot |

## Project structure

```text
SaStrane/
├── backend/                 NestJS API
│   ├── prisma/              Schema and migrations
│   ├── src/
│   │   ├── auth/            Sign-up, email codes, sessions, JWT
│   │   ├── listings/        Jobs
│   │   ├── applications/    Applications to jobs
│   │   ├── common/          Error filters and transforms
│   │   ├── config/          Environment validation, CORS
│   │   └── prisma/          Database client
│   └── test/                End-to-end tests
├── frontend/                Next.js app
│   ├── app/                 Routes
│   ├── features/            Auth, listings, applications, landing
│   ├── components/          Shared UI
│   ├── lib/                 API client, formatting
│   └── e2e/                 Playwright tests
└── docs/screenshots/
```

## Getting started

You need [Node.js 24](.nvmrc) with npm 11, and PostgreSQL. A hosted database
such as [Neon](https://neon.tech) works too. For a local one, run:

```bash
docker run -d --name sastrane-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sastrane postgres:17-alpine
```

**1. Backend.** It runs on <http://localhost:4000>.

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

In `.env`, set
`DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sastrane"`.
For development, the example values of the other variables work as they
are. Email codes are printed in the backend terminal while `RESEND_API_KEY`
is empty.

**2. Frontend.** It runs on <http://localhost:3000>.

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
| Unit tests | `npm test` (Jest) | `npm test` (Vitest) |
| End-to-end | `npm run test:e2e` (Supertest, mocked Prisma) | `npm run test:e2e` (Playwright, mocked API) |
| Build | `npm run build` | `npm run build` |

GitHub Actions runs all of these for both apps on pushes and pull requests
to `main`. Every Monday, Dependabot opens update PRs, grouped so that related
packages move together.

## Roadmap

- **Developer setup:** Docker Compose with seed data, end-to-end tests
  against a real PostgreSQL, and an OpenAPI spec with generated frontend
  types.
- **Jobs and applications:** an open and closed lifecycle for jobs, prices
  stored as numbers, fixed category and location lists, and the executor's
  email shown only after acceptance.
- **Frontend data:** cached queries and filters kept in the URL.

The app is in development and not deployed yet.
