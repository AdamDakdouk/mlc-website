# Foundation & Admin Core — Design

Sub-project 1 of 4 for MLC (Modernistic Learning Community) website, Phase 1.
Other sub-projects (not yet designed): Content Modules, Booking & Scheduling, Public Site & Marketing Polish.

## Context

- Institute: Modernistic Learning Community (MLC), Bchamoun, Lebanon.
- Stack: TypeScript + Next.js (App Router, full-stack) + MongoDB (Mongoose) — "MERN" via Next.js instead of a separate Express API.
- Bar: enterprise-grade, production-ready. Security and performance are priorities from day one.
- Theme colors (from `media/theme/`): navy `#1B3A4B`, maroon `#8B2E2E`, cream/white background. Logo at `media/logo/logo.jpg`.
- Local dev only for now — no MongoDB Atlas, no domain, no production hosting decided yet. Local MongoDB + `.env.local` for secrets.

## Goal

Deliver the foundation every later sub-project builds on: authentication, database connection, security baseline, and a working (but mostly empty) admin dashboard shell. No content-management logic yet — that's Content Modules (sub-project 2).

## Architecture

Next.js full-stack, single codebase/deployment. No separate Express API. Chosen over a split frontend/API architecture because this is a single-institute Phase-1 site — one deployment unit and one auth boundary is simpler to build and secure, at the cost of tighter coupling that's acceptable at this scale.

### Project structure

```
mlc-website/
├── src/
│   ├── app/
│   │   ├── (public)/                 # public site routes — empty for now, sub-project 4
│   │   ├── admin/
│   │   │   ├── login/
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx        # sidebar nav + header shell
│   │   │       ├── page.tsx          # overview/home
│   │   │       ├── announcements/    # placeholder
│   │   │       ├── teachers/         # placeholder
│   │   │       ├── calendar/         # placeholder
│   │   │       ├── careers/          # placeholder
│   │   │       ├── bookings/         # placeholder
│   │   │       ├── achievements/     # placeholder
│   │   │       └── meeting-requests/ # placeholder
│   │   └── api/
│   │       └── auth/
│   │           ├── login/route.ts
│   │           └── logout/route.ts
│   ├── lib/
│   │   ├── db.ts                     # Mongoose connection singleton
│   │   ├── auth.ts                   # JWT sign/verify helpers
│   │   └── env.ts                    # validated env vars (zod)
│   ├── models/
│   │   └── User.ts                   # admin schema
│   ├── middleware.ts                 # protects /admin/dashboard/* routes
│   └── types/
├── tests/
├── .env.local                        # gitignored
└── .env.example
```

## Data model (Foundation scope)

Only the admin user, for now:

```ts
User {
  email: string
  passwordHash: string   // bcrypt, 12 rounds
  role: 'admin'
  createdAt: Date
  lastLoginAt: Date
}
```

Single seeded admin account (seed script). No public registration or signup page — ever. Multi-role/multi-admin support is deferred; the `role` field exists from day one so it can be extended later without a schema migration.

## Auth flow

- `POST /api/auth/login` — validate credentials (zod) → bcrypt compare → sign short-lived JWT (2h expiry) → set as `httpOnly` + `secure` + `sameSite=strict` cookie.
- `src/middleware.ts` — intercepts `/admin/dashboard/*`, verifies JWT, redirects to `/admin/login` if invalid or missing.
- `POST /api/auth/logout` — clears the cookie.
- Login endpoint rate-limited (in-memory limiter for dev: 5 attempts / 15 min / IP) to blunt brute-force attempts.

## Security baseline

- Env vars validated with `zod` at startup — fail fast on missing/malformed config, never fall back to insecure defaults.
- Security headers set in `next.config.js`: CSP, `X-Frame-Options`, HSTS-ready.
- Every API route validates input via `zod` schemas — no unvalidated request bodies reach business logic.
- Secrets never reach the client bundle — accessed only in server-only modules.
- `.env.example` committed with placeholder keys; `.env.local` gitignored, holds real values (Mongo URI, JWT secret, Mailtrap SMTP creds, Google Calendar service account — the latter two unused until sub-project 3 but captured now so the env file is complete).

## Dashboard shell UI

- Sidebar nav linking to each future module (Announcements, Teachers, Calendar, Careers, Bookings, Achievements, Meeting Requests) — all show a "Coming soon" placeholder except a basic overview page.
- Theme: navy `#1B3A4B` / maroon `#8B2E2E` / cream-white background, MLC logo in header.

## Testing (TDD)

Jest + Testing Library. Tests written before implementation for:
- Password hashing (bcrypt helper)
- JWT sign/verify helpers
- Login route — valid credentials, invalid credentials, rate-limit trigger
- Middleware route protection — authenticated vs unauthenticated access to `/admin/dashboard/*`

## Out of scope (deferred to later sub-projects)

- Any content-management logic (announcements, teachers, calendar, careers, achievements, bookings, meeting requests) — sub-project 2/3.
- Google Calendar/Meet booking integration — sub-project 3.
- Public-facing pages — sub-project 4.
- Production hosting, domain, MongoDB Atlas, real transactional email — decided later, at deploy time. Dev uses local MongoDB and Mailtrap.
- Multi-admin / role-based access control — schema supports it (`role` field), UI/logic does not yet.
