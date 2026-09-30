# Public Site & Marketing Polish — Design

**Goal:** Turn the 9 already-built public pages (Home stub, Announcements, Teachers, Academic Calendar, Careers, Achievements, Tours, Meeting Requests) into a connected site: shared navigation and footer, a real homepage, About/Contact pages, and basic SEO plumbing (sitemap/robots). Sub-project 4 of 4 — the last piece of the original roadmap.

**Architecture:** All public routes move into a `(public)` Next.js route group with a shared `layout.tsx` providing header/footer — URLs are unchanged, admin and API routes are untouched. The homepage becomes a real landing page pulling live data (latest announcements/achievements) from existing models; no new content types or admin modules are introduced.

**Tech Stack:** Next.js 16 App Router (route groups, `sitemap.ts`/`robots.ts` metadata routes), TypeScript, Tailwind v4, existing Mongoose models (`Announcement`, `Achievement`) — no new models.

---

## Route restructuring

Move these existing folders, unchanged internally, into a new `(public)` route group (a route group's parenthesized name doesn't appear in the URL):

```
src/app/page.tsx                    → src/app/(public)/page.tsx        (rewritten, see Homepage below)
src/app/announcements/              → src/app/(public)/announcements/
src/app/teachers/                   → src/app/(public)/teachers/
src/app/calendar/                   → src/app/(public)/calendar/
src/app/careers/                    → src/app/(public)/careers/
src/app/achievements/               → src/app/(public)/achievements/
src/app/tours/                      → src/app/(public)/tours/
src/app/meeting-requests/           → src/app/(public)/meeting-requests/
```

New:
```
src/app/(public)/layout.tsx         — wraps children with SiteHeader + SiteFooter
src/app/(public)/about/page.tsx
src/app/(public)/contact/page.tsx
src/components/public/SiteHeader.tsx
src/components/public/SiteFooter.tsx
src/lib/siteContact.ts
src/app/sitemap.ts
src/app/robots.ts
```

`src/app/admin/**` and `src/app/api/**` are not touched — they're siblings of `(public)`, not inside it, so they keep using only the root `layout.tsx` (html/body shell) same as today.

## `src/lib/siteContact.ts`

Single source of truth for contact details, imported by both the footer and the Contact page (avoids the copy-paste-drift class of bug this project has hit before with duplicated regexes/comments):

```ts
export const SITE_ADDRESS = "Bchamoun, Mount Lebanon, Lebanon";
export const SITE_PHONE = "+961 5 000 000";
export const SITE_EMAIL = "mlc.modernistic@gmail.com";
```

These are placeholder values (explicitly flagged as such — see "Placeholder content" below) — real values to be swapped in later by editing this one file.

## `src/app/(public)/layout.tsx`

```tsx
import type { ReactNode } from "react";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
```

The root `src/app/layout.tsx` (html/body, fonts, global metadata) is unchanged — this nests inside it.

## `SiteHeader.tsx` (client component)

Props: none — reads its own nav list from a local const.

```ts
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/announcements", label: "Announcements" },
  { href: "/teachers", label: "Teachers" },
  { href: "/calendar", label: "Academic Calendar" },
  { href: "/careers", label: "Careers" },
  { href: "/achievements", label: "Achievements" },
  { href: "/tours", label: "Book a Tour" },
  { href: "/meeting-requests", label: "Request a Meeting" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];
```

Behavior:
- Logo + "MLC" wordmark, links to `/`.
- Desktop (`sm:` and up): horizontal nav, all 10 links. Active link (matched via `usePathname()`, exact match for `/`, prefix match for everything else — e.g. `/announcements/123` still highlights "Announcements") gets a distinct underline/color (`text-maroon` or similar, vs. default `text-navy`).
- Mobile (below `sm`): nav links hidden, a hamburger `<button>` toggles a full-width dropdown panel with the same 10 links stacked vertically. `useState` for open/closed. Button has `aria-expanded`, `aria-controls` pointing at the panel's `id`, and an accessible label ("Open menu"/"Close menu" depending on state). Panel closes on: link click (via `onClick` on each link setting state false), Escape key (`onKeyDown` at the panel or a document listener while open), and clicking outside the panel (a simple backdrop `<div>` behind the panel that closes on click — simpler and more robust than manual outside-click detection via refs).
- No sign-in/admin link here — the admin login is not part of the public nav (matches how the admin area has always been a separate, unlinked entry point, reached only by typing `/admin/login` directly).

## `SiteFooter.tsx` (server component)

- MLC name + one-line tagline.
- Contact block: `SITE_ADDRESS`, `SITE_PHONE` (as a `tel:` link), `SITE_EMAIL` (as a `mailto:` link) — imported from `siteContact.ts`.
- Secondary nav: same 10 links as the header, in a simpler stacked/wrapped list (no active-state logic needed here — footer nav is supplementary, not the primary wayfinding).
- Copyright line: `© {new Date().getFullYear()} Modernistic Learning Community. All rights reserved.`

## `(public)/page.tsx` — homepage

Server component. Replaces the current "Site coming soon" stub entirely.

```
1. Hero section: logo, "Modernistic Learning Community" heading, one-line tagline,
   two CTA buttons — "Book a Tour" (→ /tours, primary style) and "About Us" (→ /about, secondary style).
2. "Latest Announcements" section (only rendered if at least 1 exists):
   Announcement.find().sort({ createdAt: -1 }).limit(3).lean()
   Card row (reuse the visual treatment from the /announcements list page, condensed —
   title + truncated body + date), "View All Announcements" link to /announcements.
3. "Achievements" section (only rendered if at least 1 exists):
   Achievement.find().sort({ date: -1 }).limit(3).lean()
   Card row (reuse the visual treatment from /achievements — photo + title, condensed),
   "View All Achievements" link to /achievements.
```

Both DB calls run via `Promise.all` (independent queries, no reason to serialize). `export const dynamic = "force-dynamic"` (matches every other public data-driven page in this codebase).

## `(public)/about/page.tsx`

Static content, placeholder copy (see "Placeholder content" below). Sections: Mission, brief History/intro paragraph. Same page-shell conventions as other public pages (`mx-auto max-w-3xl px-6 py-12`, `text-navy` headings).

## `(public)/contact/page.tsx`

Static content: address, phone (`tel:` link), email (`mailto:` link), each pulled from `siteContact.ts`. A "Get Directions" link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE_ADDRESS)}` — no embedded map iframe (avoids a Maps API key/cost dependency for what's still placeholder address data). Same page-shell conventions as About.

## Placeholder content

Both About's body copy and `siteContact.ts`'s values are explicitly placeholder — generic, clearly-not-final text/data, e.g.:

> "Modernistic Learning Community is committed to providing a nurturing, high-quality educational environment where every student is empowered to reach their full potential. Located in Bchamoun, Lebanon, MLC combines strong academics with a supportive, community-focused approach to learning."

This is a deliberate scope boundary: this sub-project builds the *structure* (pages, nav, layout) correctly; real marketing copy and contact details are a content-editing task for later, not a re-implementation.

## `src/app/sitemap.ts`

```ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://mlc.edu.lb"; // placeholder — update once a real domain is chosen
  const routes = [
    "",
    "/announcements",
    "/teachers",
    "/calendar",
    "/careers",
    "/achievements",
    "/tours",
    "/meeting-requests",
    "/about",
    "/contact",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));
}
```

## `src/app/robots.ts`

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: "https://mlc.edu.lb/sitemap.xml", // placeholder — update once a real domain is chosen
  };
}
```

Both files use the same placeholder-domain caveat as `siteContact.ts` — flagged inline via comment, trivial to update once hosting/domain is decided (already a known deferred item from sub-project 1's scoping notes).

## Error handling

No new error paths — homepage's two DB queries follow the exact same unguarded pattern every other public server-component page in this codebase already uses (Next.js's default error boundary covers a thrown DB error; none of the other 7 public pages wrap their queries in try/catch either, so this doesn't introduce an inconsistency).

## Testing

No new API routes, no new models — nothing here needs `mongodb-memory-server`/Jest coverage under this codebase's existing testing convention (every prior public-facing, non-API page in this project has been verified manually in-browser only, never unit-tested). Verification is manual:
- Desktop nav: all 10 links resolve, active-page highlighting correct on at least 3 different pages.
- Mobile nav: hamburger opens/closes via click, Escape, and outside-click; links navigate and close the panel.
- Homepage: renders hero always; Announcements/Achievements sections render with seeded data and link correctly to their full list pages; re-verify both sections correctly disappear when their collection is empty (can be checked by temporarily filtering server-side or reasoning from the `.length === 0` guard — no need to actually empty the seeded DB).
- About/Contact: content renders, `tel:`/`mailto:`/"Get Directions" links have correct `href`s.
- `/sitemap.xml` and `/robots.txt` resolve and list expected content.
