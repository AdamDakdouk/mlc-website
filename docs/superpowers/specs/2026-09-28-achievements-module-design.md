# Achievements Module — Design

**Status:** Approved
**Sub-project:** Content Modules (module 5 of 5 — the last one: Announcements ✅, Teachers ✅, Academic Calendar ✅, Careers ✅, Achievements)

## Goal

Admin-managed list of school/student/team achievements (awards, competition wins, accreditations, honors — undifferentiated, no category system), each with an optional photo and the date the achievement happened, shown publicly as a photo-card grid.

This is architecturally the simplest module in the sub-project — it introduces no new patterns, purely recombining two already-proven pieces: Announcements' photo-upload CRUD shape and Calendar's single-date field.

## Data Model

`Achievement` (`src/models/Achievement.ts`):

| Field | Type | Notes |
|---|---|---|
| `title` | string | required, maxlength 200 |
| `description` | string | required, maxlength 2000 |
| `date` | Date | required — when the achievement happened, not when it was entered |
| `photoUrl` | string \| null | optional, nullable, default `null` |
| `createdAt`/`updatedAt` | Date | timestamps |

Sorted by `date` descending on both the admin list and public page — not `createdAt` — since an admin may backfill an older achievement after the fact and it should still sort into its correct chronological place.

## File Storage

Reuses the existing generalized `src/lib/imageUpload.ts` exactly as-is: add `"achievements"` to the `ALLOWED_FOLDERS` tuple in that file (the only change needed there), store under `public/uploads/achievements/`. Same magic-byte JPEG/PNG/WebP validation, same UUID filenames, same save-then-cleanup ordering already used by Announcements and Teachers. No new upload code is written for this module.

## Admin

**API** — `/api/admin/achievements`, mirroring `src/app/api/admin/announcements/route.ts`'s shape exactly (FormData body since there's a photo, content-length guard with the same documented `proxyClientMaxBodySize` caveat, zod validation matching Mongoose limits, `isValidObjectId` guard, fetch-then-`.save()` update pattern, save-then-cleanup file ordering on create/update/delete).

**UI** — `/admin/dashboard/achievements`:
- List page: table (photo indicator Yes/—, title, date, edit/delete via the shared `DeleteEntityButton`), sorted by `date` descending — same shape as `announcements/page.tsx`.
- `new` / `[id]/edit`: form with title, description (textarea), date (`<input type="date">`), photo (optional upload, replace/remove on edit) — same shape as `AnnouncementForm.tsx` with a date field added.

## Public

`/achievements` — a responsive photo-card grid (mirroring Teachers' grid layout: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), no auth, `force-dynamic`. Each card shows the photo if present (plain `<img>`/`next/image`, no initials-avatar fallback needed — a text-only card without a photo reads fine for an accolades list, unlike a staff directory where a person-shaped placeholder matters), title, formatted date, description. No detail page — a single flat grid page is sufficient, unlike Careers which needed a detail+apply flow.

## Testing

TDD with Jest + `mongodb-memory-server`, following the exact patterns established in Announcements/Teachers:
- Model tests: required fields, maxlengths, `photoUrl` nullable/defaults to `null`.
- API route tests: create/update/delete happy paths (with and without photo), malformed id → 400/404, validation failures → 400 (missing title/description/date, invalid photo content, oversized body → 413), file cleanup on replace/remove/delete (mirroring Announcements' test suite almost line-for-line).
- Manual smoke test (final verification task): full admin CRUD with and without photo, public grid renders correctly sorted by `date` (not `createdAt`), unauthenticated curl checks on admin routes expect 401, public page loads with no auth.

## Explicitly out of scope (YAGNI)

- Categories/tags (school vs. student/team) — explicitly decided against; a single undifferentiated list is enough.
- A detail page per achievement — the grid itself carries enough info; no drill-down needed.
- Multiple photos per achievement — one optional photo, same as every other photo-bearing module in this project.
- Featured/pinned achievements, manual reordering — sorted purely by `date`, no admin-controlled order field (unlike Teachers, which needed manual `order` since staff listing order isn't naturally chronological).
