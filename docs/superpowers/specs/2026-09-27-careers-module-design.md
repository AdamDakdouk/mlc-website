# Careers Module — Design

**Status:** Approved
**Sub-project:** Content Modules (module 4 of 5: Announcements ✅, Teachers ✅, Academic Calendar ✅, Careers, Achievements)

## Goal

Admin-managed job postings, publicly listed, with an on-site application form (name/email/phone/resume/cover note) that stores submissions for admin review — no external application link, no email notifications (dashboard-list-only, matching the project's deferred-email-infra stance).

This module is architecturally different from every prior content module: it introduces the site's first **public, unauthenticated write path** (submitting an application) and its first genuinely **private** file storage (resumes contain applicant PII and must not be reachable via a guessable public URL, unlike teacher photos/announcement images).

## Data Models

### `JobPosting` (`src/models/JobPosting.ts`)

| Field | Type | Notes |
|---|---|---|
| `title` | string | required, maxlength 200 |
| `description` | string | required, maxlength 5000 |
| `requirements` | string | optional, maxlength 5000, default `""` |
| `status` | enum | `"Open"` \| `"Closed"`, required, default `"Open"` |
| `createdAt`/`updatedAt` | Date | timestamps |

### `Application` (`src/models/Application.ts`)

| Field | Type | Notes |
|---|---|---|
| `postingId` | ObjectId ref | required, references `JobPosting` |
| `name` | string | required, maxlength 200 |
| `email` | string | required, maxlength 254, validated as an email shape |
| `phone` | string | required, maxlength 30 |
| `resumeUrl` | string | required — a private filesystem path, NOT under `public/` |
| `coverNote` | string | optional, maxlength 2000, default `""` |
| `submittedAt` | Date | set at creation (`default: Date.now`) |

No `status` field on `Application` (e.g. reviewed/rejected) — out of scope per YAGNI; admin reviews by looking and deletes when done with a candidate.

## File Storage: Private Resumes

Resumes are stored **outside** `public/` — e.g. `uploads-private/resumes/<uuid>.pdf` at the project root (a new sibling directory to `public/`, added to `.gitignore` the same way `public/uploads/` presumably already is — verify and match that pattern). This directory is never served by Next.js's static file handling, so a resume is only ever reachable through:

- `GET /api/admin/careers/applications/[id]/resume` — reads the file from disk and streams it back with `Content-Type: application/pdf` and a `Content-Disposition` header suggesting a sensible filename. Protected by the existing `proxy.ts` matcher (`/api/admin/:path*`) — no new auth code needed, same as every other admin route.

A new `src/lib/resumeUpload.ts` sibling to `src/lib/imageUpload.ts` handles validation and saving: magic-byte check for the PDF signature (`%PDF-`), a size cap (e.g. 5MB), UUID filename generation, saving to the private directory. Deleting an `Application` also deletes its resume file (delete DB record first, then file — same ordering principle as every other module's file cleanup).

## Admin

**API:**
- `POST/PUT/DELETE /api/admin/careers[/[id]]` — `JobPosting` CRUD, plain JSON body (no upload), mirrors the Academic Calendar module's route shape exactly (content-length guard, zod validation matching Mongoose limits, `isValidObjectId` guard, fetch-then-`.save()` for updates).
- `GET /api/admin/careers/[id]/applications` — list applications for a posting, newest first.
- `DELETE /api/admin/careers/applications/[id]` — delete one application (and its resume file, per the ordering above).
- `GET /api/admin/careers/applications/[id]/resume` — stream the resume file (described above).

**UI:**
- `/admin/dashboard/careers` — table of postings (title, status badge, application count via a count query, edit/delete via the shared `DeleteEntityButton`).
- `new` / `[id]/edit` — form: title, description (textarea), requirements (textarea), status dropdown (Open/Closed).
- `/admin/dashboard/careers/[id]/applications` — table of that posting's applications (name, email, phone, submitted date, a resume download link pointing at the streaming route, delete button, and the cover note shown inline or on click).

## Public

- `/careers` — lists postings where `status === "Open"` only (closed postings simply don't appear on this page — no placeholder needed). Each posting shows title + a truncated/full description with a link to its own page or an inline expand.
- `/careers/[id]` — full posting detail (description, requirements) plus the application form.
- Application form fields: name, email, phone, resume (file input, `accept="application/pdf"`, client-side hint only — server does the real validation), cover note (optional textarea). On submit: `POST /api/careers/[id]/apply` (note: **not** under `/api/admin/`, so NOT covered by the proxy — this is the intentional public write path). On success, the form is replaced with a simple "Application submitted" confirmation message (no email, no redirect needed).
- If the posting is `Closed` or the id doesn't exist, `/careers/[id]` returns a 404 (`notFound()`), and its apply endpoint also rejects (400/404) — a closed posting must not silently accept new applications via direct API calls, even if hidden from the public list.

## Security (new attack surface — this module's key departure from prior ones)

`POST /api/careers/[id]/apply` is the site's first unauthenticated write endpoint. It needs, explicitly:
- Content-length guard sized for a resume (~5MB cap, not the 100KB text-only cap used by Calendar, but also not the 10MB image cap — resumes are typically 1-3MB).
- PDF magic-byte validation via `resumeUpload.ts` (never trust the client's declared MIME type or filename extension).
- zod validation on all text fields (name/email/phone/coverNote) with the same length caps as the Mongoose schema.
- Verify the target posting exists and `status === "Open"` before accepting — reject otherwise.
- No execution of uploaded content, ever (it's saved as an opaque file, never interpreted).
- Explicitly out of scope: rate-limiting/CAPTCHA/spam-prevention beyond basic validation — matches this project's existing pattern of deferring production-hardening infra (rate limiting, real email, etc.) until a hosting target is chosen, but this specific gap is worth calling out since it's the one endpoint anyone on the internet can hit without logging in.

## Testing

TDD with Jest + `mongodb-memory-server`, following established patterns:
- Model tests: `JobPosting` (required fields, status enum, maxlengths) and `Application` (required fields, email shape validation, `postingId` reference).
- API route tests: postings CRUD (mirroring Calendar's test shape), application submission (valid PDF accepted, non-PDF rejected, oversized file rejected, missing required fields rejected, submitting to a closed/nonexistent posting rejected), admin application list/delete/resume-download (including an auth-boundary test confirming unauthenticated requests to admin routes get 401, and confirming the resume-download route actually requires auth — this is the module's most security-sensitive test).
- Manual smoke test (final verification task): full flow — create an Open posting, submit a public application with a real small PDF, confirm it shows in admin's application list, download and confirm the resume via the admin route, confirm downloading it while logged out fails, delete the application (confirm resume file removed from disk), close the posting (confirm it disappears from `/careers` but the posting and past applications remain in admin), confirm applying to a closed posting is rejected.

## Explicitly out of scope (YAGNI)

- Email notifications to admin on new application, or confirmation email to applicant — deferred, matches the project's existing deferred-email-infra stance.
- Application status tracking (reviewed/interviewing/rejected/hired) — admin just views and deletes.
- Rate limiting / CAPTCHA / spam prevention on the public apply endpoint beyond basic field/file validation.
- Resume preview in the admin UI (e.g. inline PDF viewer) — a plain download link is enough.
- Multiple file uploads per application, or resume replacement/re-application flow.
- Posting categories/departments/locations/tags — a posting is just title + description + requirements + status.
