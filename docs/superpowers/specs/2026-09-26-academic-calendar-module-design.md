# Academic Calendar Module — Design

**Status:** Approved
**Sub-project:** Content Modules (module 3 of 5: Announcements ✅, Teachers ✅, Academic Calendar, Careers, Achievements)

## Goal

Admin-managed calendar of academic dates, holidays, and school events, displayed publicly as a month-grid calendar (Google Calendar–style spanning bars for multi-day events), with prev/next month navigation.

## Data Model

`src/models/CalendarEvent.ts`:

| Field | Type | Notes |
|---|---|---|
| `title` | string | required, maxlength 200 |
| `category` | enum | `"Academic"` \| `"Holiday"` \| `"Event"`, required |
| `startDate` | Date | required |
| `endDate` | Date | required; defaults to `startDate` when omitted on create; validated `endDate >= startDate` |
| `description` | string | optional, maxlength 1000, default `""` |
| `createdAt`/`updatedAt` | Date | timestamps |

No image/photo field — this module has no file upload, unlike Announcements/Teachers.

**Category → color mapping** (used on the public grid): Academic = navy (`#1B3A4B`), Holiday = maroon (`#8B2E2E`), Event = gold (`#C9A227`).

## Admin

**API** — `/api/admin/calendar` (extend `proxy.ts` matcher to cover it, same as existing modules):
- `POST /api/admin/calendar` — create. zod validation mirrors the Mongoose limits exactly (200/1000 char caps, category enum, endDate >= startDate). Content-length guard against oversized bodies (no file, so a small fixed cap, e.g. 100KB, is enough — no need for the 10MB image-upload allowance Teachers/Announcements use).
- `PUT /api/admin/calendar/[id]` — update. Same validation. `mongoose.isValidObjectId` guard before `findById`.
- `DELETE /api/admin/calendar/[id]` — delete. Same id guard. No file cleanup needed (no uploaded files for this module).

**UI** — `/admin/dashboard/calendar`:
- List page: plain table (title, category badge, date range, edit/delete), sorted by `startDate` ascending. Delete via the existing shared `src/components/admin/DeleteEntityButton.tsx`. No drag-reorder — order is derived from date, not manual.
- `new` / `[id]/edit` pages: form with title (text input), category (dropdown of the 3 fixed values), start date (`<input type="date">`), end date (`<input type="date">`, optional — if left blank, submit uses `startDate`), description (textarea, optional).

## Public

**Page** — `/calendar`, `force-dynamic`, no auth:
- Month-grid view. 7-column grid, one row per week. Multi-day events render as a colored bar spanning their date range across the grid (per the approved "Spanning bars" mockup); single-day events render as a one-cell bar.
- Prev/next month navigation via a query param, e.g. `/calendar?month=2026-10`; defaults to the current month when the param is absent or invalid.
- Clicking/tapping an event bar reveals its title + description (small popover or an expand-below panel — implementer's call on exact interaction, staying simple).
- **Mobile fallback:** below a defined breakpoint (~500px), the grid is hard to read with spanning bars — render a stacked list of that month's events instead (title, date range, category badge) rather than a cramped grid. Use the same data, just a different template branch based on viewport/media query or a CSS-only approach (grid hidden below breakpoint, list shown instead) — implementer's call on server vs. CSS-driven approach, whichever fits the existing codebase patterns best.

## Testing

TDD with Jest + `mongodb-memory-server`, following the exact patterns established in Teachers/Announcements:
- Model tests: schema validation (required fields, enum rejection, endDate-before-startDate rejection, defaulting endDate to startDate).
- API route tests: create/update/delete happy paths, malformed id → 404, validation failures → 400 (missing title, bad category, endDate < startDate, oversized body → 413).
- Manual smoke test (final verification task): full admin CRUD, public grid renders correct month, prev/next nav works and preserves category colors, multi-day bar spans correctly across a month boundary (e.g. an event that starts in one month and ends in the next — decide and document how the grid handles this: **the bar should render clipped to the visible month, continuing to the next/previous page**), mobile list fallback, unauthenticated curl checks on admin routes expect 401, public page loads with no auth.

## Explicitly out of scope (YAGNI)

- Recurring events (e.g. "every Monday") — not requested, not needed for a school's academic calendar which is manually curated per term.
- iCal export/subscription feed — not requested.
- Event photos/attachments — not requested, no upload needed.
- Admin calendar-grid view (WYSIWYG) — admin uses a plain table + form, matching existing modules; only the public page gets the grid treatment.
