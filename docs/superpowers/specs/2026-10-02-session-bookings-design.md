# Session Bookings — Design

**Goal:** Let admin post bookable "sessions" (e.g. a Math session with a specific teacher, date/time, and duration) on the Academic Calendar. Students apply through a public form, pay via Whish (a Lebanese P2P payment app — no API integration, purely manual), upload proof of payment, and wait for admin verification. Once verified, they receive a confirmation email with the session's details.

**Architecture:** "Session" becomes a new category on the existing `CalendarEvent` model, carrying extra fields that only apply to that category. A new `SessionApplication` model tracks each sign-up through Pending → Verified/Rejected. Capacity is enforced with an atomic conditional increment on `CalendarEvent` (no check-then-write race). A new `src/lib/mailer.ts` sends the confirmation email via the already-scaffolded Mailtrap SMTP config, best-effort (a send failure never blocks verification).

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose, Zod, `nodemailer` (new dependency) + Mailtrap SMTP (dev), private filesystem storage for payment proofs (same pattern as Careers' resumes).

---

## Decisions made without a separate question (flagged for review)

- **Price currency: USD.** Matches common practice for private tutoring/sessions in Lebanon. Trivial to relabel if wrong — it's just a number with a "$" shown next to it, no currency-conversion logic anywhere.
- **Rejected applications keep their payment-proof file** (not deleted) — the admin may want to double-check a disputed rejection later. The file is only deleted when the *application record itself* is deleted (mirrors how deleting a Careers `Application` deletes its resume).
- **A rejected application cannot be re-verified, and a verified one cannot be re-rejected** — `PUT` only accepts a transition away from `"Pending"`, once. To reapply after a rejection, the student submits a brand-new application (per your answer).

## Data model

### `CalendarEvent` (extended)

```ts
export interface ICalendarEvent extends Document {
  title: string;
  category: Category; // now includes "Session"
  startDate: Date;
  endDate: Date;
  description: string;
  // Session-only fields — required when category === "Session", absent otherwise:
  teacherId?: Types.ObjectId; // ref "Teacher"
  sessionDateTime?: Date;     // the actual bookable date + time
  durationMinutes?: number;
  capacity?: number;
  price?: number;             // USD
  applicantCount: number;     // default 0, system-managed only
  createdAt: Date;
  updatedAt: Date;
}
```

`src/lib/calendarCategories.ts`: `CATEGORIES` gains `"Session"`. `CATEGORY_BG_CLASS`/`CATEGORY_TEXT_CLASS` get a `Session` entry (reuse the `Academic` navy treatment — same contrast-safe pairing already verified for that background).

For grid placement, `startDate` and `endDate` are both set to the **date portion** of `sessionDateTime` when the category is `"Session"` — the calendar grid, `monthUtils.ts`, and `CalendarGrid.tsx` need zero changes; a Session is just a single-day event as far as the grid is concerned.

Schema notes:
- `teacherId`: `Schema.Types.ObjectId, ref: "Teacher"` — required only via application-layer validation (Mongoose-level `required` can't be conditional cleanly here; the zod schema in both admin routes enforces it, same approach already used for optional-vs-required patterns elsewhere in this codebase).
- `sessionDateTime`: `Date`, validated with the existing `isRealDateTime`/`DATETIME_RE` helpers from `src/lib/dateTime.ts` (no new date-validity helper needed).
- `durationMinutes`: `Number`, min 1, max 480 (8 hours — a sanity ceiling, not a real business rule).
- `capacity`: `Number`, min 1, max 500.
- `price`: `Number`, min 0, max 100000.
- `applicantCount`: `Number, default: 0` — never set directly by a client; only ever touched via the atomic `$inc` operations described below.

### `SessionApplication` (new)

```ts
export interface ISessionApplication extends Document {
  sessionId: Types.ObjectId; // ref "CalendarEvent"
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentProofFilename: string;
  status: SessionApplicationStatus; // "Pending" | "Verified" | "Rejected"
  submittedAt: Date;
}
```

`src/lib/sessionApplicationStatuses.ts` (new, same shape as `meetingRequestStatuses.ts`):
```ts
export const SESSION_APPLICATION_STATUSES = ["Pending", "Verified", "Rejected"] as const;
export type SessionApplicationStatus = (typeof SESSION_APPLICATION_STATUSES)[number];
```

Field limits: `name` max 200, `email` max 254, `phone` max 30, `address` max 200 — same limits as every other contact-field trio in this codebase (Careers' `Application`, `MeetingRequest`). `submittedAt: { type: Date, default: Date.now }` — immutable record, same reasoning as `Application` (a submission's timestamp never changes; contrast with `MeetingRequest`'s `{ timestamps: true }`, which is correct there because admin actively edits `confirmedDateTime`/`status` — here, admin only ever moves `status` forward once, and `submittedAt` itself is never touched, so the simpler explicit-field pattern fits better than adding `updatedAt` noise).

### `src/lib/siteContact.ts` (extended)

```ts
export const SITE_WHISH_CONTACT = "+961 3 000 000"; // placeholder — update once a real Whish number/link is available
```

## Private payment-proof storage

`src/lib/paymentProofUpload.ts` (new — mirrors `resumeUpload.ts`'s private-storage shape, but validates images the way `imageUpload.ts` does):

```ts
const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private", "payment-proofs");
const FILENAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
```

- `validateAndSavePaymentProof(file: File): Promise<string>` — magic-byte check (JPEG/PNG/WebP, same three signatures as `imageUpload.ts`'s `detectImageType`, duplicated here rather than imported since it isn't exported — matches this codebase's existing per-upload-utility structure, not a shared generic one), 5MB cap, returns the bare filename (not a URL — this is never served as a static path).
- `readPaymentProofFile(filename: string): Promise<Buffer>` — filename-regex-validated before any `path.join`, same path-traversal defense as `readResumeFile`.
- `deletePaymentProofFile(filename: string): Promise<void>` — same ENOENT-tolerant delete as the sibling utilities.

`uploads-private/` is already `.gitignore`d from the Careers module — no change needed there.

## Public flow

### Calendar detail panel (`CalendarGrid.tsx`, extended)

When `selected.category === "Session"`, the detail panel additionally shows: teacher name, formatted date/time (not just the date), duration ("1h 30m"), price ("$20"), and spots remaining (`capacity - applicantCount`). An "Apply" link to `/calendar/[id]/apply` appears unless the session is full (`applicantCount >= capacity`) or `sessionDateTime` has already passed — in either case the panel shows "Session full" or "Applications closed" text instead of the link.

To render the teacher name and these extra fields, `GridEvent`/`CalendarEventLike` (`monthUtils.ts`) gains optional fields: `teacherName?: string`, `sessionDateTime?: string` (ISO), `durationMinutes?: number`, `price?: number`, `capacity?: number`, `applicantCount?: number`. The calendar page (`(public)/calendar/page.tsx`) resolves `teacherId → teacherName` via a `Teacher.find().select("name")` lookup Map, same plain-lookup pattern already used on the Meeting Requests admin list page (no `.populate()`).

### `/calendar/[id]/apply` (new public page)

Server component: fetches the `CalendarEvent` by id, 404s if missing or not category `"Session"`. Renders a summary (title, teacher, date/time, duration, price, spots remaining) and a client form.

`SessionApplyForm.tsx` (new client component, mirrors `ApplicationForm.tsx`'s shape):
- Fields: Name, Email, Phone, Address (all required text inputs, same styling as every other contact form in this app).
- A payment-instructions block: "Send **$&lt;price&gt;** via Whish to **&lt;SITE_WHISH_CONTACT&gt;**, then upload a screenshot of the payment below."
- Payment proof file input (required, `accept="image/jpeg,image/png,image/webp"`).
- Submits as one `FormData` POST to `/api/calendar/${sessionId}/apply`, same single-submission shape as `ApplicationForm.tsx`.
- On success: "Application received — you'll get a confirmation email once your payment is verified."
- On "session is full" (409) or "applications closed" (409, past date) responses: shown as the form's error message, same as any other rejected submission.

### `POST /api/calendar/[id]/apply` (new, public, unauthenticated)

Lives outside `/api/admin/` — the third unauthenticated public write endpoint in the app, after Careers' apply route and the (now-removed) Tour Bookings route. Same security discipline as Careers': content-length cap sized for one image (6MB, matching Careers' resume-upload cap reasoning), magic-byte file validation, generic error messages.

```ts
const sessionApplicationFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().min(1).max(254).email(),
  phone: z.string().min(1).max(30),
  address: z.string().min(1).max(200),
});
```

Order of operations:
1. Content-length cap check.
2. `mongoose.isValidObjectId(id)` → 404 (not 400 — matches Careers' apply route, which 404s a malformed id rather than 400ing it, since this is a public-facing not-found surface, not an admin form).
3. Parse `FormData`, zod-validate the four text fields → 400 on failure.
4. Load the `CalendarEvent`; 404 if missing or `category !== "Session"` (uniform 404, same anti-enumeration reasoning as Careers' closed-posting handling).
5. 409 "This session's applications are closed" if `sessionDateTime` has passed.
6. **Atomic capacity reservation**: `CalendarEvent.findOneAndUpdate({ _id: id, category: "Session", $expr: { $lt: ["$applicantCount", "$capacity"] } }, { $inc: { applicantCount: 1 } })`. If this returns `null` (no document matched — either already full or, extremely unlikely, deleted mid-request), return 409 "This session is full." This is the one atomicity-sensitive operation in the whole feature: two requests racing for the last spot can't both succeed, because MongoDB evaluates the filter (including `$expr`) and applies the update as a single atomic per-document operation.
7. Validate + save the payment proof file. If this throws, **roll back the increment** (`$inc: { applicantCount: -1 }`) before returning the error — same "undo the side effect you already committed" discipline as every other upload-then-persist flow in this codebase.
8. `SessionApplication.create(...)`. If this throws, roll back **both** the increment and the just-saved proof file, then rethrow.
9. Return `201 { id }`.

## Admin flow

### Admin Calendar list (`admin/dashboard/calendar/page.tsx`, extended)

Session rows show an "Applications (N)" link to `/admin/dashboard/calendar/[id]/applications`, computed via `SessionApplication.countDocuments({ sessionId: e._id })` per row (same `Promise.all` shape as the Careers admin list's per-posting application counts). Non-Session rows show `—` in that column instead.

### `CalendarEventForm.tsx` (extended)

When `category === "Session"` is selected, the form swaps its Start/End Date inputs for: a single "Date & Time" `datetime-local` input, "Duration (minutes)" number input, "Teacher" `<select>` (options fetched server-side and passed in as a prop, same as how `MeetingRequestClient` receives its teacher list), "Capacity" number input, "Price (USD)" number input. Switching the category dropdown toggles which field set is visible client-side; only the fields matching the currently-selected category are required.

The admin calendar new/edit pages (`new/page.tsx`, `[id]/edit/page.tsx`) fetch `Teacher.find().select("name").sort({ order: 1 })` and pass the list into the form, same shape as how the Meeting Requests public page fetches teachers.

### `POST /api/admin/calendar` / `PUT /api/admin/calendar/[id]` (extended)

Base zod schema unchanged for non-Session categories. A `.superRefine` adds conditional requiredness:

```ts
.superRefine((data, ctx) => {
  if (data.category !== "Session") return;
  if (!data.teacherId) ctx.addIssue({ code: "custom", path: ["teacherId"], message: "Teacher is required" });
  if (!data.sessionDateTime) ctx.addIssue({ code: "custom", path: ["sessionDateTime"], message: "Date & time is required" });
  if (data.durationMinutes === undefined) ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "Duration is required" });
  if (data.capacity === undefined) ctx.addIssue({ code: "custom", path: ["capacity"], message: "Capacity is required" });
  if (data.price === undefined) ctx.addIssue({ code: "custom", path: ["price"], message: "Price is required" });
})
```

When `category === "Session"`: validate `teacherId` is a real, existing `Teacher` (`Teacher.findById`, 400 if missing — same check style as Meeting Requests' booking route), validate `sessionDateTime` with `isRealDateTime`, derive `startDate = endDate = <date portion of sessionDateTime>` for grid storage. On **edit**, if capacity is lowered below the current `applicantCount`, that's allowed (existing applicants aren't retroactively bumped) — new applications just can't push `applicantCount` past the new, lower `capacity`, which the existing atomic `$expr` check already handles correctly with no special-casing needed.

When category is anything else: `teacherId`/`sessionDateTime`/`durationMinutes`/`capacity`/`price` are all cleared to `undefined`/unset on save (so switching a Session back to a plain category doesn't leave stale session data hanging off the document) — `applicantCount` is left untouched (harmless if orphaned; no code path reads it for non-Session categories).

### `DELETE /api/admin/calendar/[id]` (extended)

Same referential-integrity guard already established for Teacher deletion (blocked when `MeetingRequest`s reference it): before deleting a `CalendarEvent`, check `SessionApplication.exists({ sessionId: id })` and return 409 "Cannot delete a session with existing applications" if any exist, for any status — otherwise deleting the session would orphan its applications (their `sessionId` would point to nothing, and the admin would lose all access to view/manage them, since the per-session applications page 404s once the parent event is gone). Non-Session categories are unaffected (the `exists` check is always `false` for them, so this is a no-op cost, not a behavior change).

### `/admin/dashboard/calendar/[id]/applications` (new)

Mirrors `careers/[id]/applications/page.tsx` exactly in structure: session title as the subheading, each application shown as a card (name, email · phone, address, submitted date, status badge), a "View payment proof" link to the authenticated download route, and per-application actions.

`SessionApplicationActions.tsx` (new client component): Verify / Reject / Delete buttons, same shape as `MeetingRequestActions.tsx` but simpler (no datetime field to adjust — this is a pure status transition).
- Verify → `PUT /api/admin/calendar/applications/[id]` with `{ status: "Verified" }`.
- Reject → same endpoint with `{ status: "Rejected" }`.
- Delete → `DELETE /api/admin/calendar/applications/[id]` (mirrors Careers' applications delete route: removes the record and its proof file).

### `PUT /api/admin/calendar/applications/[id]` (new)

```ts
const UPDATABLE_STATUSES = ["Verified", "Rejected"] as const satisfies readonly SessionApplicationStatus[];
```

1. `mongoose.isValidObjectId` → 400.
2. zod-validate `{ status }` → 400.
3. Load the application; 404 if missing.
4. **409 if `existing.status !== "Pending"`** — no re-verifying a rejected application or re-rejecting a verified one (per your answer: reapplying means a brand-new application, not resurrecting an old one).
5. If transitioning to `"Rejected"`: atomically decrement the parent session's `applicantCount` (`$inc: { applicantCount: -1 }`, no `$expr` guard needed here — a Pending application's slot is always accounted for, so decrementing can't go negative in practice, but the increment is still wrapped in the same "this is the one place we care about atomicity" discipline for consistency).
6. If transitioning to `"Verified"`: **send the confirmation email** (see below) — best-effort, failure is logged (`console.error`) but does not fail the request or roll back the status change. This mirrors the project's standing decision to treat real email delivery as deferred/best-effort infrastructure (Mailtrap sandbox in dev, no production email provider chosen yet) while still building the feature that depends on it.
7. Save `existing.status = <new status>`.
8. Return `200 { success: true }`.

### `GET /api/admin/calendar/applications/[id]/payment-proof` (new)

Mirrors the Careers resume-download route exactly: loads the application, `readPaymentProofFile`, returns the buffer with `Content-Type` inferred from the stored extension (jpg→`image/jpeg`, png→`image/png`, webp→`image/webp`) and `Content-Disposition: inline` (an image should preview in-browser, unlike the resume PDF which forces a download — a small, deliberate deviation from the mirrored pattern, justified by the different content type).

### `DELETE /api/admin/calendar/applications/[id]` (new)

Mirrors Careers' applications delete route: validates id, loads the application, deletes the record, deletes its proof file. **Does not** touch `applicantCount` — deleting a record is an administrative cleanup action, not a status transition; only `Reject` frees a reserved spot (deleting a `Pending` application without rejecting it first would silently strand a reserved spot forever, so this is called out explicitly: **admins should Reject before Delete, not Delete directly, for a Pending application** — the UI doesn't currently prevent deleting a Pending application directly, which is a known minor gap worth a one-line warning in the confirm dialog rather than new logic, since it's an edge case an admin triggers deliberately, not an public-facing risk).

## Email

`src/lib/mailer.ts` (new):

```ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendSessionConfirmationEmail(params: {
  to: string;
  recipientName: string;
  sessionTitle: string;
  teacherName: string;
  sessionDateTime: Date;
  durationMinutes: number;
  price: number;
}): Promise<void> {
  await transporter.sendMail({
    from: '"Modernistic Learning Community" <no-reply@mlc.edu.lb>',
    to: params.to,
    subject: `You're confirmed: ${params.sessionTitle}`,
    text: [
      `Hi ${params.recipientName},`,
      "",
      `Your payment has been verified and your spot in "${params.sessionTitle}" is confirmed.`,
      "",
      `Teacher: ${params.teacherName}`,
      `Date & time: ${params.sessionDateTime.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "full", timeStyle: "short" })}`,
      `Duration: ${params.durationMinutes} minutes`,
      `Price paid: $${params.price}`,
      `Location: ${SITE_ADDRESS}`,
      "",
      "See you there!",
      "Modernistic Learning Community",
    ].join("\n"),
  });
}
```

Plain-text only (no HTML template) — matches this project's YAGNI stance elsewhere and keeps the first version simple; an HTML template is a trivial follow-up if wanted later. New dependency: `nodemailer` (+ `@types/nodemailer` as a dev dependency).

## Error handling

Same conventions as every prior module — generic user-facing error messages, 404-uniformity for the public apply route, zod validation at every boundary, magic-byte file validation, and the "commit the DB write, only then clean up the filesystem" ordering used everywhere else. The one new discipline is the atomic `$inc`/`$expr` capacity operations described above — this is the single place in the whole app where a plain check-then-write race would produce a real, user-visible bug (overselling seats) rather than a cosmetic one, so it gets the atomic treatment instead of the accepted-tradeoff treatment used for e.g. the Teacher reorder endpoint.

## Testing

Full TDD per route/model, same as every prior module:
- `CalendarEvent` model: existing tests untouched; new tests for the Session-only fields' presence/absence, and that `applicantCount` defaults to 0.
- `SessionApplication` model: required-field tests, status enum test, `submittedAt` default test.
- `paymentProofUpload.ts`: mirrors `resumeUpload.test.ts`'s shape — valid JPEG/PNG/WebP accepted, oversized rejected, non-image rejected, path-traversal-proof filename validation on read/delete.
- `POST /api/calendar/[id]/apply`: valid application succeeds and increments `applicantCount`; missing fields rejected; invalid/missing proof file rejected; non-existent/non-Session event → 404; past-`sessionDateTime` event → 409; full session → 409; **concurrent-applies-at-the-last-spot test** — fire two applies at a session with `capacity - applicantCount === 1` and assert exactly one succeeds (this is the test that actually proves the atomic `$expr` guard works, not just that the code compiles).
- `PUT /api/admin/calendar/applications/[id]`: Verify sends email (mock `sendSessionConfirmationEmail`, assert it was called with the right args) and doesn't touch `applicantCount`; Reject decrements `applicantCount` and doesn't send email; re-transitioning an already-Verified/Rejected application → 409; email-send failure doesn't fail the request (mock a rejected promise, assert status is still 200).
- `DELETE /api/admin/calendar/applications/[id]`: deletes record + proof file, doesn't touch `applicantCount`.
- `DELETE /api/admin/calendar/[id]`: 409 + no deletion when a `SessionApplication` references it (any status); unaffected non-Session deletion still works exactly as before (regression check on the existing test file).
- `GET .../payment-proof`: returns the right `Content-Type` per stored extension; 404 for a missing file.
- Admin `POST`/`PUT /api/admin/calendar`: Session-category requires all five session fields (one test per missing field, matching this project's established one-test-per-required-field convention); non-Session categories reject session fields being nonsensical only in the sense that they're simply ignored, not validated — a non-Session `POST` with a stray `teacherId` in the body is harmless and doesn't need a dedicated test, since the schema doesn't read those keys for non-Session categories at all.
