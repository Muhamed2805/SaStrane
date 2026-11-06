# Deploying SaStrane

SaStrane runs on free tiers of managed services. Each piece has its own
account:

| Piece | Service | Settings in the repository |
| --- | --- | --- |
| Frontend | Vercel | `frontend/vercel.json` |
| Backend | Render | `render.yaml` |
| PostgreSQL | Neon | |
| Job and profile photos | Cloudflare R2 | |
| Email | Resend | |

Everything runs in or near Frankfurt. Pushing to `main` deploys again:
Vercel builds the frontend, and Render builds the backend when something
under `backend/` changed. Render's build applies new migrations.

## Limits of the free setup

- **The backend sleeps.** Render stops a free service after 15 minutes
  without requests. The next request wakes it, which takes up to a minute,
  so the first page load after a pause is slow. Unread-message emails are
  not sent while it sleeps.
- **Email goes to one address only.** Without a domain, Resend sends from
  `onboarding@resend.dev` and only to the email of the Resend account.
  Other people cannot get the code that confirms a new account, so they
  cannot sign in. A verified domain fixes this (see the last section).
- **Photo links are rate limited.** The `r2.dev` address of the bucket is
  meant for development. A custom domain removes the limit.
- The production database starts empty: the seed refuses to run in
  production, because the demo users share a known password.

## 1. Database: Neon

1. Create a project on <https://neon.tech>, with PostgreSQL 17 in
   **AWS Europe Central 1 (Frankfurt)**.
2. Open **Connect**, turn off **Connection pooling**, and copy the
   connection string. Migrations need a direct connection.
3. Replace everything after `?` with `sslmode=verify-full`:

   ```text
   postgresql://<user>:<password>@<host>.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full
   ```

   This is `DATABASE_URL`.

## 2. Photos: Cloudflare R2

1. In the Cloudflare dashboard, open **R2**. Cloudflare asks for a payment
   method before the first bucket, but the first 10 GB are free.
2. Create the bucket `sastrane-photos`.
3. In the bucket's **Settings**, enable the **Public Development URL**.
   Its address, such as `https://pub-<id>.r2.dev`, is `S3_PUBLIC_URL`.
4. Under **R2 > Manage API tokens**, create a token with **Object Read &
   Write** on this bucket only. Note:
   - the **Access Key ID** (`S3_ACCESS_KEY_ID`);
   - the **Secret Access Key** (`S3_SECRET_ACCESS_KEY`);
   - the S3 endpoint, `https://<account-id>.r2.cloudflarestorage.com`
     (`S3_ENDPOINT`).

Do not run `npm run storage:init` here: the bucket already exists.

## 3. Email: Resend

1. Sign up on <https://resend.com> with the email address you will use for
   your own SaStrane account.
2. Create an API key with **Sending access**. This is `RESEND_API_KEY`.

## 4. Backend: Render

1. On <https://render.com>, choose **New > Blueprint** and connect the
   GitHub repository. Render reads `render.yaml`.
2. Fill in the values it asks for:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | From Neon |
   | `APP_URL` | The frontend address, such as `https://sastrane.vercel.app` |
   | `CORS_ORIGINS` | The same address |
   | `RESEND_API_KEY` | From Resend |
   | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | From R2 |

   Render generates `JWT_SECRET` and `EMAIL_VERIFICATION_SECRET`, and
   `render.yaml` sets the rest.
3. Wait for the first deploy, then open `https://<service>.onrender.com/health`.
   It answers `{"status":"ok","database":"up", ...}` when the API reaches
   the database.

The frontend address is known only after step 5. When it differs from what
you entered, change `APP_URL` and `CORS_ORIGINS` under the service's
**Environment**, and Render deploys again. Later changes to `sync: false`
values in `render.yaml` are ignored: change them in the dashboard.

## 5. Frontend: Vercel

1. On <https://vercel.com>, choose **Add New > Project** and import the
   repository.
2. Set **Root Directory** to `frontend`. Vercel detects Next.js.
3. Add the environment variables:

   | Variable | Value |
   | --- | --- |
   | `BACKEND_URL` | The Render address, such as `https://sastrane-api.onrender.com` |
   | `SITE_URL` | The frontend address, such as `https://sastrane.vercel.app` |

   Both are read at build time, so redeploy after changing them.
4. Under **Settings > Build and Deployment**, choose Node.js 24, as in
   `.nvmrc`.
5. Deploy.

The browser calls the API through the frontend's `/api` path, so the
refresh cookie belongs to the frontend's domain.

## 6. The first admin

1. Sign up on the site with the Resend account's email, and confirm it
   with the emailed code.
2. On your computer, in `backend/`, run:

   ```bash
   DATABASE_URL="<the Neon URL>" npm run admin -- you@example.com
   ```

   In PowerShell, set it first with `$env:DATABASE_URL = "<the Neon URL>"`.
   A value in the environment wins over `backend/.env`.

3. Reload the site. **Prijave** appears in the user menu.

## Later: your own domain

With a domain, for example from Cloudflare:

- **Email:** add the domain in Resend, add its DNS records, and set
  `EMAIL_FROM` to an address on the domain, such as
  `SaStrane <noreply@example.com>`. Then everyone gets their codes.
- **Site:** add the domain to the Vercel project, then update `SITE_URL` in
  Vercel and `APP_URL` and `CORS_ORIGINS` in Render.
- **Photos:** connect a subdomain to the R2 bucket, such as
  `photos.example.com`, and set `S3_PUBLIC_URL` to it. The API builds photo
  links from it, so older photos move to the new address too.
