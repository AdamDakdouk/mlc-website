# Meeting Requests Module — Design

**Goal:** Let parents request a meeting with a specific teacher through a public page, and let admins confirm, decline, or delete those requests from the dashboard. Second and final module of sub-project 3 (Booking & Scheduling).

**Architecture:** Mirrors the Tour Bookings module's proven pattern (open request → admin confirms/declines with a datetime) with one addition: the request is tied to a specific `Teacher` document via `teacherId`, which requires a small guard on the existing teacher-deletion endpoint to prevent orphaned references.

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose, Zod validation, Tailwind v4 — same as all prior modules. No file uploads in this module.

---

## Data Model

`src/models/MeetingRequest.ts`

```ts
interface IMeetingRequest {
  parentName: string;       // required, max 200
  parentEmail: string;      // required, max 254, email format
  parentPhone: string;      // required, max 30
  studentName: string;      // required, max 200
  studentGrade: string;     // required, max 50, free text (e.g. "Grade 5", "KG2")
  teacherId: ObjectId;      // required, ref "Teacher"
  reason: string;           // optional, default "", max 2000
  requestedDateTime: Date;  // required
  confirmedDateTime: Date | null; // default null
  status: MeetingRequestStatus;   // "Pending" | "Confirmed" | "Declined", default "Pending"
  createdAt: Date;
  updatedAt: Date;
}
```

Uses `{ timestamps: true }` — this is a mutable record (status changes over its life), same reasoning as `TourBooking`, not the immutable-record pattern used for Careers' `Application`.

`src/lib/meetingRequestStatuses.ts`

```ts
export const MEETING_REQUEST_STATUSES = ["Pending", "Confirmed", "Declined"] as const;
export type MeetingRequestStatus = (typeof MEETING_REQUEST_STATUSES)[number];
```

## Public Flow

**`src/app/meeting-requests/page.tsx`** (server component)
- `await connectToDatabase(); const teachers = await Teacher.find().sort({ order: 1 }).lean();`
- Renders `TeacherPicker` (client component) with the teacher list, then `MeetingRequestForm` below it.

**`src/app/meeting-requests/TeacherPicker.tsx`** (client component)
- Card grid, same visual shape as `/teachers` page cards (photo or initial-avatar fallback, name, subjects).
- Each card is a clickable/keyboard-selectable control (`role="radio"` within `role="radiogroup"`, or a styled radio input under the hood for accessibility) that sets a `selectedTeacherId` state.
- Selected card gets a visible highlight (border + background, e.g. `border-navy bg-navy/5`).
- Lifts `selectedTeacherId` to the parent page via a shared state (page.tsx becomes a client wrapper, or `TeacherPicker` and `MeetingRequestForm` are combined into one client component `MeetingRequestPage` that owns the selection state — simpler, avoids prop-drilling through a server component). **Decision: combine picker + form into one client component** `MeetingRequestClient.tsx` that owns `selectedTeacherId` state, rendered by the server page with `teachers` passed as a prop.

**`src/app/meeting-requests/MeetingRequestClient.tsx`** (client component, replaces the separate TeacherPicker/Form split above)
- Props: `teachers: { _id: string; name: string; photoUrl: string | null; subjects: string[] }[]`
- Renders the card grid; clicking a card sets `selectedTeacherId`.
- Below the grid, the request form (parentName, parentEmail, parentPhone, studentName, studentGrade, requestedDateTime, reason) is always visible but disabled/greyed until a teacher is selected (or simply validated on submit — pick the simpler option: **submit-time validation**, matching the form's existing pattern of not disabling fields preemptively elsewhere in the app).
- On submit: if no teacher selected, show inline error "Please select a teacher" without hitting the network.
- Otherwise `POST /api/meeting-requests/book` with `{ teacherId, parentName, parentEmail, parentPhone, studentName, studentGrade, requestedDateTime, reason }`.
- Success → same "Request received" confirmation message pattern as `BookingForm`.

**`src/app/api/meeting-requests/book/route.ts`** (public POST, unauthenticated — lives outside `/api/admin/` so `proxy.ts` doesn't gate it, same as `/api/tours/book`)

```ts
const meetingRequestFieldsSchema = z.object({
  parentName: z.string().min(1).max(200),
  parentEmail: z.string().min(1).max(254).email(),
  parentPhone: z.string().min(1).max(30),
  studentName: z.string().min(1).max(200),
  studentGrade: z.string().min(1).max(50),
  teacherId: z.string().min(1),
  requestedDateTime: z.string().regex(DATETIME_RE),
  reason: z.string().max(2000).optional(),
});
```

Validation order (matches `/api/tours/book`):
1. Content-length cap check (`MAX_REQUEST_SIZE = 100 * 1024`, same inline DoS-caveat comment as tours/careers — no file upload here either).
2. JSON parse → 400 on failure.
3. Zod schema → 400 generic "Please check the form fields and try again" on failure.
4. `mongoose.isValidObjectId(teacherId)` → 400 "Invalid teacher" if not.
5. `isRealDateTime(requestedDateTime)` → 400 "Invalid date/time" if not.
6. `Teacher.findById(teacherId)` → 404 "Teacher not found" if missing (real existence check, not just format — prevents creating requests against phantom teachers).
7. Create `MeetingRequest` with `status: "Pending"`.
8. Return `201 { id }`.

## Admin Flow

**`src/app/admin/dashboard/meeting-requests/page.tsx`**
- `MeetingRequest.find().sort({ createdAt: -1 }).populate("teacherId", "name").lean()`
- Table columns: Parent name, Student name, Teacher, Requested, Status (badge, same `STATUS_BADGE_CLASS` pattern keyed by `MeetingRequestStatus`), View link.

**`src/app/admin/dashboard/meeting-requests/[id]/page.tsx`**
- `mongoose.isValidObjectId(id)` guard → `notFound()`.
- `MeetingRequest.findById(id).populate("teacherId", "name").lean()` → `notFound()` if missing.
- `<dl>` of all fields (parent name/email/phone, student name/grade, teacher name, requested datetime, reason if present).
- Renders `MeetingRequestActions`.

**`src/app/admin/dashboard/meeting-requests/[id]/MeetingRequestActions.tsx`** (client component, same shape as `BookingActions.tsx`)
- `datetime-local` input defaulting to `confirmedDateTime ?? requestedDateTime`.
- Confirm button → `PUT` with `{ status: "Confirmed", confirmedDateTime }`.
- Decline button → `PUT` with `{ status: "Declined" }`.
- Delete button → `confirm()` dialog, then `DELETE`.
- On success, `router.push("/admin/dashboard/meeting-requests"); router.refresh();`.

**`src/app/api/admin/meeting-requests/[id]/route.ts`**
- `PUT`: same structure as `admin/tours/[id]/route.ts` — `UPDATABLE_STATUSES = ["Confirmed", "Declined"] as const satisfies readonly MeetingRequestStatus[]`, same confirmedDateTime fallback logic (explicit value wins, else keep existing confirmed value, else fall back to requestedDateTime).
- `DELETE`: `mongoose.isValidObjectId` guard, `findById` → 404 if missing, `deleteOne`, `{ success: true }`. No file cleanup (no uploads in this module).

## Cross-Module Change: Teacher Deletion Guard

**`src/app/api/admin/teachers/[id]/route.ts`** — `DELETE` handler

Before `Teacher.deleteOne({ _id: id })`, add:

```ts
const hasMeetingRequests = await MeetingRequest.exists({ teacherId: id });
if (hasMeetingRequests) {
  return NextResponse.json(
    { error: "Cannot delete a teacher with existing meeting requests" },
    { status: 409 },
  );
}
```

This runs for *any* status (Pending/Confirmed/Declined) — the design intentionally doesn't special-case declined/old requests, since historical records referencing a since-deleted teacher would break the admin detail view's `.populate()`. Keeps referential integrity guaranteed rather than best-effort.

**Admin Teachers UI implication:** the existing `DeleteEntityButton` component just surfaces whatever error message the API returns, so a 409 here will show "Cannot delete a teacher with existing meeting requests" via its existing error-handling path — no UI change needed, only verify this at test time.

## Navigation

`src/app/admin/dashboard/layout.tsx` — `NAV_ITEMS` already has a `"/admin/dashboard/meeting-requests"` entry with label "Meeting Requests" (added when Overview was removed, ahead of this module's build). No change needed here.

## Error Handling Summary

Same conventions as every prior module:
- Malformed/missing fields → 400, generic user-facing message, no field-level detail leaked.
- Invalid ObjectId → 400.
- Not found → 404.
- Oversized request → 413.
- Invalid datetime string → 400 via `isRealDateTime`/`DATETIME_RE` (imported from existing `src/lib/dateTime.ts`, not duplicated).
- Teacher deletion blocked by existing requests → 409.

## Testing Plan

- **Model:** `MeetingRequest` required-field validation, status enum validation, default status "Pending".
- **`meetingRequestStatuses.ts`:** trivial, only tested indirectly through route tests (no standalone logic).
- **Public route (`/api/meeting-requests/book`):** valid payload → 201; missing/invalid fields → 400; invalid teacherId format → 400; well-formed but nonexistent teacherId → 404; invalid datetime (real-date guard, e.g. `2026-13-40`) → 400; oversized body → 413; malformed JSON → 400.
- **Admin route (`/api/admin/meeting-requests/[id]`):** PUT Confirmed with explicit datetime; PUT Confirmed without datetime (falls back correctly); PUT Declined; invalid status value rejected; invalid id → 400; missing record → 404; DELETE removes record; DELETE missing record → 404.
- **Teacher deletion guard:** deleting a teacher with zero meeting requests succeeds (existing behavior unchanged); deleting a teacher with a Pending/Confirmed/Declined request returns 409 and the teacher is NOT deleted (verify record still exists after the call).
