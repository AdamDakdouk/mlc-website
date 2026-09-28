# Tour Bookings Module — Design

**Status:** Approved
**Sub-project:** Booking & Scheduling (module 1 of 2: Tour/Admission Bookings, Meeting Requests)

## Goal

Public-facing tour/admission-visit request form (name/email/phone/visitor count/preferred date-time/notes) that admin reviews and confirms or declines, optionally adjusting the date/time when confirming.

This module follows the same architectural shape as the Careers module's application flow — a public, unauthenticated write endpoint reviewed by admin — but simpler: no file upload, no "posting" concept to apply against (a booking request stands alone), and JSON body instead of FormData.

Real Google Calendar/Meet integration remains deferred (per the Foundation sub-project's original scoping) until a hosting target is chosen. This module stores and manages booking requests in MongoDB only; no external calendar events or notification emails are created. Admin manages the full lifecycle from the dashboard.

## Data Model

`TourBooking` (`src/models/TourBooking.ts`):

| Field | Type | Notes |
|---|---|---|
| `name` | string | required, maxlength 200 |
| `email` | string | required, maxlength 254, validated as an email shape (zod, not Mongoose — matches the `Application` model's precedent from Careers) |
| `phone` | string | required, maxlength 30 |
| `numberOfVisitors` | number | required, min 1, max 50 (a sane ceiling — this is a school tour, not a stadium event) |
| `notes` | string | optional, maxlength 2000, default `""` |
| `requestedDateTime` | Date | required — the visitor's preferred date/time |
| `confirmedDateTime` | Date \| null | nullable, default `null` — set by admin when confirming (may match or differ from `requestedDateTime`) |
| `status` | enum | `"Pending" \| "Confirmed" \| "Declined"`, required, default `"Pending"` |
| `submittedAt` | Date | `default: Date.now` (no `{ timestamps: true }` — same reasoning as `Application`: `submittedAt` already covers creation time, and a booking is only ever created then transitioned through status, never otherwise "updated" in a way `updatedAt` would meaningfully track) |

## Public

- `/tours` — a single page: brief intro copy + the booking request form. No listing of anything (unlike Careers' `/careers` list — there's no "posting" to browse here, just a direct request form).
- Form fields: name, email, phone, number of visitors (`<input type="number" min="1">`), preferred date/time (`<input type="datetime-local">`), notes (optional textarea).
- Submits to `POST /api/tours/book` — **the site's second unauthenticated public write endpoint** (after Careers' apply route). Same security posture required: strict zod validation, no trust in anything beyond validated shape, a content-length guard appropriate for a small JSON-only body (no file, so a small cap like the Calendar module's 100KB is appropriate, not Careers' 6MB file-inclusive cap).
- On success: the form is replaced with a plain "Request received — we'll be in touch to confirm" message, no email confirmation sent (deferred, matches Careers' precedent).

## Admin

**API:**
- `GET /api/admin/tours` is NOT needed as a separate endpoint — the admin list page queries `TourBooking` directly server-side (same pattern as every other admin list page in this project; no module so far has needed a separate "list" API route for its own admin page, only Careers needed one because applications are nested under postings).
- `PUT /api/admin/tours/[id]` — updates `status` (to `"Confirmed"` or `"Declined"`) and, when confirming, optionally `confirmedDateTime`. zod validation: `status` enum required; `confirmedDateTime` optional (a `datetime-local`-shaped string, validated similarly to how the Calendar/Achievements modules validate date strings — reuse date-validity reasoning, though this is a full datetime not just a date, so the exact validation approach needs its own regex/parsing, not a direct reuse of `isRealCalendarDate` which is `YYYY-MM-DD`-only).
- `DELETE /api/admin/tours/[id]` — removes a booking (for cleaning up spam/duplicate/mistaken submissions). No cascading concerns (no child records, no files).

**UI:**
- `/admin/dashboard/bookings` — list of bookings sorted by `submittedAt` descending: status badge, requested date/time, visitor name, visitor count. Table row links to a detail/confirm view.
- A confirm/decline view (could be inline on the list page via a form per row, or a dedicated `/admin/dashboard/bookings/[id]` page — implementer's call on the exact UI shape, but it must let admin see full booking details, set/adjust `confirmedDateTime`, and choose Confirm or Decline) plus the shared `DeleteEntityButton` for removal.

## Testing

TDD with Jest + `mongodb-memory-server`, following established patterns:
- Model tests: required fields, `numberOfVisitors` min/max bounds, status enum, `confirmedDateTime` nullable/defaults to `null`.
- API route tests: public booking creation (happy path, validation failures for each required field, malformed email, oversized body), admin confirm/decline (status transitions, `confirmedDateTime` handling, malformed/missing id), delete (malformed/missing id).
- Manual smoke test (final verification task): submit a public booking request, confirm it appears in admin pending list, confirm it with an adjusted date/time, confirm the adjusted time shows correctly, decline a different test booking, delete a booking, confirm unauthenticated admin route access is rejected (401), confirm the public booking endpoint works without auth.

## Explicitly out of scope (YAGNI)

- Real Google Calendar event creation or Google Meet link generation — deferred until hosting is chosen (per Foundation sub-project scoping, reconfirmed for this module).
- Email notifications to the visitor on confirm/decline — deferred, matches Careers' precedent.
- Slot-based/capacity-limited scheduling (admin pre-defining specific bookable time slots) — explicitly decided against during brainstorming in favor of open requests that admin manually reviews.
- Visitor-facing status lookup (e.g. "check your booking status" page) — visitor has no way to check status online; admin/school follows up directly (phone/in-person, or email once that infra exists).
- Rate limiting/CAPTCHA/spam prevention beyond basic field validation on the public endpoint — same deferred-hardening stance as Careers' apply endpoint.
