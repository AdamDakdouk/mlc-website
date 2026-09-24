# MLC Website

Website for Modernistic Learning Community (MLC), Bchamoun, Lebanon.

## Stack

TypeScript, Next.js (App Router), MongoDB + Mongoose, Tailwind CSS v4.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values (a local dev config with placeholder secrets is enough to run the app; see comments in `.env.example` for what each var is for).
3. Start local MongoDB: `mongod`, or `docker run -d -p 27017:27017 mongo`.
4. Seed the admin user: `npm run seed`
5. Start the dev server: `npm run dev`
6. Visit `http://localhost:3000/admin/login` and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local`.

## Testing

`npm test` runs the full Jest suite (uses an in-memory MongoDB for DB-touching tests — no local MongoDB required for tests, only for running the app itself).

## Project structure

See `docs/superpowers/specs/2026-09-23-foundation-admin-core-design.md` for the architecture this was built from.
