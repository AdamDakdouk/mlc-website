# Content Modules — Announcements — Design

First module of sub-project 2 ("Content Modules") for the MLC website. Content Modules is being built one module at a time rather than as one large batch — Announcements first, to establish the admin-CRUD + public-display pattern that Teachers, Academic Calendar, Careers, and Achievements will reuse.

## Context

- Builds on sub-project 1 (Foundation & Admin Core), merged to `master`: Next.js 16 (App Router), TypeScript, MongoDB + Mongoose, JWT auth (`jose`) via httpOnly cookie, `src/proxy.ts` protecting `/admin/dashboard/:path*`, admin dashboard shell with a placeholder page at `/admin/dashboard/announcements`.
- Single admin, no multi-role access control (unchanged from Foundation).
- Object storage (S3/R2/Cloudinary) deferred until production hosting is chosen — this module uses local filesystem storage.

## Goal

Replace the `/admin/dashboard/announcements` placeholder with real admin CRUD, and add a public `/announcements` page. No draft/publish workflow — creating an announcement makes it immediately public.

## Architecture

Server Components for public reads (the public list page queries MongoDB directly server-side — no API round-trip needed for a read-only page). API routes for admin writes (create/update/delete), consistent with the request-handling pattern the auth system already established, rather than introducing Server Actions as a second pattern.

**Auth extension:** `src/proxy.ts`'s matcher currently only covers `/admin/dashboard/:path*` (pages). This module adds admin API routes under `/api/admin/*`, which need the same JWT protection. Rather than repeating an auth check in every new route handler, the proxy's `config.matcher` is extended to `["/admin/dashboard/:path*", "/api/admin/:path*"]` — one source of truth for admin auth enforcement, applying to both current and future admin API routes.

## Data model

```ts
Announcement {
  title: string        // required
  body: string          // required
  imageUrl: string | null   // "/uploads/announcements/<uuid>.<ext>", or null if no image
  createdAt: Date
  updatedAt: Date
}
```

No status/draft field — existence in the collection means it's public. No category/tag field — deferred, not required for this module's scope.

## Routes

**Public:**
- `src/app/announcements/page.tsx` — Server Component, queries `Announcement.find()` sorted newest-first, paginated 10 per page via `?page=N` query param. Full title/body/image/date shown inline per announcement (no separate detail pages).

**Admin (all behind the proxy, single admin only):**
- `src/app/admin/dashboard/announcements/page.tsx` — replaces the Foundation placeholder. Table of all announcements (thumbnail, title, date, edit/delete actions), "+ New" button.
- `src/app/admin/dashboard/announcements/new/page.tsx` — create form: title, body, optional image file input.
- `src/app/admin/dashboard/announcements/[id]/edit/page.tsx` — edit form, pre-filled from the existing record.
- `POST /api/admin/announcements` — create. Accepts `multipart/form-data` (title, body, optional image file) so the image upload and record creation happen in one request.
- `PUT /api/admin/announcements/[id]` — update. Same multipart shape; omitting the image field leaves the existing image untouched, a special `removeImage` flag clears it.
- `DELETE /api/admin/announcements/[id]` — delete. Also deletes the associated image file from disk if one exists. Admin UI shows a confirm dialog before calling this.

## Image upload

- Accepted types: JPEG, PNG, WebP only (validated by actual file content/magic bytes server-side, not just the client-supplied MIME type or extension — never trust client input for this).
- Max size: 5MB, enforced server-side; a request exceeding this is rejected with a clear error before the file is written to disk.
- Filename: a randomly generated UUID plus the validated extension — the original uploaded filename is never used directly (avoids path traversal and collision issues).
- Storage path: `public/uploads/announcements/<uuid>.<ext>`, referenced in the DB as `/uploads/announcements/<uuid>.<ext>` (a public URL path Next.js serves directly from `public/`).
- On delete (or on update when an image is replaced/removed), the old file is deleted from disk — no orphaned files accumulating.

## Testing

TDD, following Foundation's established pattern:
- `Announcement` model tests (required fields, defaults) using `mongodb-memory-server`.
- API route tests for create/update/delete, including image-validation edge cases (wrong type, oversized file, missing file when creating without an image).
- A test confirming the extended proxy matcher actually protects `/api/admin/announcements` (redirect/401 when unauthenticated, pass-through when authenticated) — mirroring Foundation's Task 12 proxy tests.
- Public and admin *pages* (the React components/forms) are verified manually in-browser, not heavily unit-tested — matching how Foundation's UI tasks (login page, dashboard shell) were verified.

## Out of scope for this module

- Draft/publish workflow (always-public on create, per design decision).
- Categories/tags.
- Individual detail pages (single inline paginated list instead).
- Cloud image storage (local filesystem only; revisit when production hosting is chosen).
- Any change to Teachers/Calendar/Careers/Achievements — those get their own specs once Announcements ships and the pattern is proven.
