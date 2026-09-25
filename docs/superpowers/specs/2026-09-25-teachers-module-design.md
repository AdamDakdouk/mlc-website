# Content Modules — Teachers — Design

Second module of sub-project 2 ("Content Modules") for the MLC website, built after Announcements (already shipped and merged), reusing and extending its established patterns.

## Context

- Builds on sub-project 1 (Foundation & Admin Core) and the Announcements module, both merged to `master`.
- Admin auth via JWT cookie, `src/proxy.ts` protecting `/admin/dashboard/:path*` and `/api/admin/:path*` (matcher already covers this module's routes — no proxy changes needed).
- Local filesystem image storage (no cloud storage yet, per Foundation's design).
- Announcements established the shape this module reuses: Server Components for public reads, API routes for admin writes, zod validation matching Mongoose `maxlength` exactly, `mongoose.isValidObjectId` guards before every `findById`, filesystem deletes only after a DB write is confirmed (never before).

## Goal

Replace the `/admin/dashboard/teachers` placeholder with real admin CRUD (create/edit/delete, photo upload, drag-and-drop manual ordering), and add a public `/teachers` page showing all staff.

## Shared utility refactor

`src/lib/imageUpload.ts` currently hardcodes `public/uploads/announcements/` as its storage path. This module generalizes it to accept a `folder` parameter:

```ts
validateAndSaveImage(file: File, folder: string): Promise<string>  // returns "/uploads/<folder>/<uuid>.<ext>"
deleteImageFile(imageUrl: string): Promise<void>  // folder is parsed from imageUrl itself, no signature change needed
```

Existing Announcements call sites are updated to pass `"announcements"` explicitly. This avoids duplicating a security-relevant file (magic-byte validation, UUID filenames, path-traversal guards) across modules.

## Data model

```ts
Teacher {
  name: string          // required
  photoUrl: string | null
  subjects: string[]    // required, min 1 — each value validated against SUBJECTS list
  qualifications: string  // free text, optional
  experience: string      // free text, optional
  order: number          // drag-and-drop position; new teachers append to the end (max existing order + 1)
  createdAt: Date
  updatedAt: Date
}
```

`src/lib/subjects.ts` exports a hardcoded `SUBJECTS` string array (Math, Physics, Chemistry, Biology, English, Arabic, French, History, Geography, Computer Science, Art, Music, Physical Education) — used by both the API's zod validation (`z.enum` or a `.refine()` membership check) and the admin form's multi-select checkboxes. Editing the list means editing code, not a DB — acceptable since subject offerings rarely change for a single institute.

No draft/publish state — same as Announcements, creating a teacher makes it immediately public.

## Routes

**Public:**
- `src/app/teachers/page.tsx` — Server Component, queries `Teacher.find().sort({ order: 1 })`, renders a grid of cards (photo or placeholder avatar, name, subjects, qualifications, experience) — all info inline, no detail pages, no pagination (small staff list).

**Admin (all behind the proxy):**
- `src/app/admin/dashboard/teachers/page.tsx` — replaces the placeholder. Drag-and-drop reorderable list (photo thumbnail, name, subjects, edit/delete actions), "+ New" button. Unlike Announcements' pure Server Component list, this page needs client-side interactivity for drag-and-drop.
- `src/app/admin/dashboard/teachers/new/page.tsx` — create form.
- `src/app/admin/dashboard/teachers/[id]/edit/page.tsx` — edit form, pre-filled, same `mongoose.isValidObjectId` guard pattern as Announcements' edit page.
- `POST /api/admin/teachers` — create. Multipart form: `name`, `subjects` (repeated field or JSON-encoded array), `qualifications`, `experience`, optional `photo` file.
- `PUT /api/admin/teachers/[id]` — update. Same image replace/remove semantics as Announcements (`removeImage` flag), same save-then-cleanup filesystem ordering to avoid ever leaving a live record pointing at a deleted file.
- `DELETE /api/admin/teachers/[id]` — delete. Removes the DB record before the associated photo file (same ordering rationale as Announcements' delete route).
- `PUT /api/admin/teachers/reorder` — accepts a JSON body `{ ids: string[] }` (the full list of teacher ids in their new order), sets each teacher's `order` field to its index in that array. Single bulk operation, not N separate requests.

## Drag-and-drop

Uses `@dnd-kit/core` + `@dnd-kit/sortable` (new dependency — actively maintained, accessible with keyboard support, React 19 compatible). The admin list page becomes a Client Component wrapping the draggable rows; on drop, it POSTs the new id order to the reorder endpoint and calls `router.refresh()`.

## Image handling

Identical rules to Announcements: JPEG/PNG/WebP only (magic-byte validated), 5MB max, UUID filenames, stored at `public/uploads/teachers/<uuid>.<ext>`. Photo is optional at creation — the public card and admin list show a placeholder/initials avatar when absent.

## Testing

TDD, following the established pattern:
- `Teacher` model tests (required fields — name, min-1 subjects — optional fields, order default).
- `imageUpload.ts`'s generalized `folder` parameter (update existing Announcements tests to pass `"announcements"` explicitly; add Teachers-specific tests confirming files land under `public/uploads/teachers/`).
- API route tests for all four endpoints (create/update/delete/reorder), including: image-validation edge cases, malformed-id handling, 404s, save-then-cleanup ordering (mirroring Announcements' regression tests for the same bug class), and a test confirming `reorder` correctly sets `order` values from the submitted id array.
- Public and admin pages verified manually in-browser. The actual drag interaction is verified manually (drag physics aren't meaningfully unit-testable), but the `reorder` API route itself gets full automated coverage.

## Out of scope for this module

- Admin-manageable subject list (hardcoded in code instead).
- Structured qualifications/degrees (free text instead).
- Individual teacher detail/profile pages (single grid page instead).
- "Available teaching sessions" display on teacher cards — deferred to the Booking & Scheduling sub-project (3), which doesn't exist yet.
- Cloud image storage (local filesystem only, same as Announcements).
