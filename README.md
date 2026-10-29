# SaStrane

[![CI](https://github.com/Muhamed2805/SaStrane/actions/workflows/ci.yml/badge.svg)](https://github.com/Muhamed2805/SaStrane/actions/workflows/ci.yml)

SaStrane is a two-sided marketplace for local side-hustle jobs 
(lawn mowing, moving, small IT tasks, etc).

## Tech Stack

### Frontend
- Next.js
- TypeScript
- TailwindCSS
- Zustand

### Backend
- NestJS
- Prisma ORM
- PostgreSQL (Neon)
- JWT Authentication

---

## Project Structure
SaStrane/
backend/
frontend/

--- 

## Running the project

### Backend
cd backend
npm install
npx prisma generate
npm run start:dev

Run `npx prisma generate` again after every schema change. The client is
generated into `src/generated/prisma`, which git ignores.

### Frontend
cd frontend
npm install
npm run dev

The frontend forwards `/api/*` to the backend, so the refresh cookie stays
first-party. Set `BACKEND_URL` (default `http://localhost:4000`) before
`npm run dev` or `npm run build`; the build fixes the value.

---

## Status

MVP in development.
