# Public Site & Marketing Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the 9 existing public pages with shared navigation/footer, replace the homepage stub with a real landing page, add About/Contact pages, and add sitemap/robots. Sub-project 4 of 4 — final piece of the original roadmap.

**Architecture:** Move all public route folders into a `(public)` route group with a shared layout (header+footer); URLs unchanged. New homepage pulls live data from existing `Announcement`/`Achievement` models — no new models or API routes.

**Tech Stack:** Next.js 16 App Router (route groups, `sitemap.ts`/`robots.ts`), TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-01-public-site-marketing-polish-design.md`

**Note on testing:** this plan has no TDD steps. None of the 9 existing public pages have unit tests (this codebase only tests API routes, models, and pure non-React logic like `monthUtils.ts`) — this sub-project follows that same convention. Every task instead ends with `npx tsc --noEmit` and, where relevant, `npx jest` to confirm no regressions, plus a final manual browser verification task.

---

### Task 1: Move public routes into a `(public)` route group

**Files:**
- Move: `src/app/page.tsx` → `src/app/(public)/page.tsx`
- Move: `src/app/announcements/` → `src/app/(public)/announcements/`
- Move: `src/app/teachers/` → `src/app/(public)/teachers/`
- Move: `src/app/calendar/` → `src/app/(public)/calendar/`
- Move: `src/app/careers/` → `src/app/(public)/careers/`
- Move: `src/app/achievements/` → `src/app/(public)/achievements/`
- Move: `src/app/tours/` → `src/app/(public)/tours/`
- Move: `src/app/meeting-requests/` → `src/app/(public)/meeting-requests/`

None of these files' internal imports need to change: they use `@/lib/...`/`@/models/...`/`@/components/...` absolute imports (unaffected by physical location) or relative imports within their own folder (e.g. `calendar/__tests__/monthUtils.test.ts` imports `../monthUtils` — this stays correct since the whole `calendar/` folder moves as a unit). A route group's parenthesized folder name does not appear in the URL, so `/announcements`, `/teachers`, etc. all resolve exactly as before.

- [ ] **Step 1: Create the route group directory and move each folder**

Run from repo root (`C:\dev\mlc-website`):

```bash
mkdir -p "src/app/(public)"
git mv src/app/page.tsx "src/app/(public)/page.tsx"
git mv src/app/announcements "src/app/(public)/announcements"
git mv src/app/teachers "src/app/(public)/teachers"
git mv src/app/calendar "src/app/(public)/calendar"
git mv src/app/careers "src/app/(public)/careers"
git mv src/app/achievements "src/app/(public)/achievements"
git mv src/app/tours "src/app/(public)/tours"
git mv src/app/meeting-requests "src/app/(public)/meeting-requests"
```

- [ ] **Step 2: Verify nothing broke**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: full suite still passes (this move touches no test logic, only file locations — `calendar/__tests__/monthUtils.test.ts`'s relative import `../monthUtils` still resolves correctly since both files moved together).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move public routes into a (public) route group"
```

---

### Task 2: Shared contact constants

**Files:**
- Create: `src/lib/siteContact.ts`

- [ ] **Step 1: Write the file**

```ts
// Placeholder contact details — update once real values are available.
export const SITE_ADDRESS = "Bchamoun, Mount Lebanon, Lebanon";
export const SITE_PHONE = "+961 5 000 000";
export const SITE_EMAIL = "info@mlc.edu.lb";
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/siteContact.ts
git commit -m "feat: add shared site contact constants"
```

---

### Task 3: Site header with mobile nav

**Files:**
- Create: `src/components/public/SiteHeader.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo.jpg"
            alt="MLC logo"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-lg font-semibold text-navy">MLC</span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive(pathname, link.href)
                  ? "text-sm font-medium text-maroon"
                  : "text-sm font-medium text-navy transition hover:text-maroon"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-panel"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded text-navy sm:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav-panel"
          ref={panelRef}
          className="border-t border-gray-200 bg-white px-6 py-4 sm:hidden"
        >
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={
                  isActive(pathname, link.href)
                    ? "text-sm font-medium text-maroon"
                    : "text-sm font-medium text-navy"
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (the `href="/about"` and `href="/contact"` links point at pages that don't exist yet — Tasks 7/8 — this doesn't cause a compile error, only a 404 if clicked before those tasks land).

- [ ] **Step 3: Commit**

```bash
git add src/components/public/SiteHeader.tsx
git commit -m "feat: add site header with mobile nav"
```

---

### Task 4: Site footer

**Files:**
- Create: `src/components/public/SiteFooter.tsx`

- [ ] **Step 1: Write the component**

```tsx
import Link from "next/link";
import { SITE_ADDRESS, SITE_EMAIL, SITE_PHONE } from "@/lib/siteContact";

const FOOTER_LINKS = [
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

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-lg font-semibold text-navy">Modernistic Learning Community</p>
            <p className="mt-2 text-sm text-gray-600">
              Providing quality education in Bchamoun, Lebanon.
            </p>
            <div className="mt-4 space-y-1 text-sm text-gray-600">
              <p>{SITE_ADDRESS}</p>
              <p>
                <a href={`tel:${SITE_PHONE}`} className="hover:text-maroon">
                  {SITE_PHONE}
                </a>
              </p>
              <p>
                <a href={`mailto:${SITE_EMAIL}`} className="hover:text-maroon">
                  {SITE_EMAIL}
                </a>
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 sm:justify-end">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-navy hover:text-maroon"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 text-xs text-gray-500">
          © {new Date().getFullYear()} Modernistic Learning Community. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/public/SiteFooter.tsx
git commit -m "feat: add site footer"
```

---

### Task 5: Wire header/footer into the public route group

**Files:**
- Create: `src/app/(public)/layout.tsx`

- [ ] **Step 1: Write the layout**

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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/layout.tsx"
git commit -m "feat: wire site header/footer into the public layout"
```

---

### Task 6: Real homepage

**Files:**
- Modify: `src/app/(public)/page.tsx` (currently the moved "Site coming soon" stub from Task 1 — full rewrite)

- [ ] **Step 1: Write the page**

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import { Achievement } from "@/models/Achievement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLC — Modernistic Learning Community",
  description: "Modernistic Learning Community (MLC), Bchamoun, Lebanon.",
};

export default async function HomePage() {
  await connectToDatabase();
  const [announcements, achievements] = await Promise.all([
    Announcement.find().sort({ createdAt: -1 }).limit(3).lean(),
    Achievement.find().sort({ date: -1 }).limit(3).lean(),
  ]);

  return (
    <div>
      <section className="flex flex-col items-center bg-cream px-6 py-16 text-center">
        <Image
          src="/images/logo.jpg"
          alt="MLC logo"
          width={96}
          height={96}
          className="rounded-full"
          priority
        />
        <h1 className="mt-6 text-3xl font-semibold text-navy">
          Modernistic Learning Community
        </h1>
        <p className="mt-2 max-w-xl text-gray-600">
          A nurturing, high-quality educational environment in Bchamoun, Lebanon.
        </p>
        <div className="mt-6 flex gap-4">
          <Link
            href="/tours"
            className="rounded bg-navy px-5 py-2.5 font-medium text-white transition hover:bg-navy/90"
          >
            Book a Tour
          </Link>
          <Link
            href="/about"
            className="rounded border border-navy px-5 py-2.5 font-medium text-navy transition hover:bg-navy/5"
          >
            About Us
          </Link>
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-navy">Latest Announcements</h2>
            <Link href="/announcements" className="text-sm text-navy hover:underline">
              View All Announcements
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {announcements.map((a) => (
              <article key={a._id.toString()} className="rounded-lg border border-gray-200 p-5">
                {a.imageUrl && (
                  <Image
                    src={a.imageUrl}
                    alt={a.title}
                    width={320}
                    height={180}
                    className="mb-3 w-full rounded object-cover"
                  />
                )}
                <h3 className="font-semibold text-navy">{a.title}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-gray-700">{a.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {achievements.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-navy">Achievements</h2>
            <Link href="/achievements" className="text-sm text-navy hover:underline">
              View All Achievements
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {achievements.map((a) => (
              <article key={a._id.toString()} className="rounded-lg border border-gray-200 p-5">
                {a.photoUrl && (
                  <Image
                    src={a.photoUrl}
                    alt={a.title}
                    width={320}
                    height={180}
                    className="mb-3 w-full rounded object-cover"
                  />
                )}
                <h3 className="font-semibold text-navy">{a.title}</h3>
                <p className="mt-1 text-xs text-maroon">
                  {a.date.toLocaleDateString(undefined, { timeZone: "UTC" })}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-gray-700">{a.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/page.tsx"
git commit -m "feat: replace homepage stub with a real landing page"
```

---

### Task 7: About page

**Files:**
- Create: `src/app/(public)/about/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — MLC",
  description: "Learn about Modernistic Learning Community's mission and history.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-semibold text-navy">About MLC</h1>
      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold text-navy">Our Mission</h2>
        <p className="text-gray-700">
          Modernistic Learning Community is committed to providing a nurturing,
          high-quality educational environment where every student is empowered
          to reach their full potential. We combine strong academics with a
          supportive, community-focused approach to learning.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold text-navy">Our Story</h2>
        <p className="text-gray-700">
          Located in Bchamoun, Lebanon, MLC serves students across all grade
          levels with a dedicated team of teachers and staff focused on
          academic excellence, character development, and preparing students
          for lifelong success.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/about/page.tsx"
git commit -m "feat: add About page"
```

---

### Task 8: Contact page

**Files:**
- Create: `src/app/(public)/contact/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";
import { SITE_ADDRESS, SITE_EMAIL, SITE_PHONE } from "@/lib/siteContact";

export const metadata: Metadata = {
  title: "Contact — MLC",
  description: "Get in touch with Modernistic Learning Community.",
};

export default function ContactPage() {
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE_ADDRESS)}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-semibold text-navy">Contact Us</h1>
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-navy">Address</dt>
          <dd className="mt-1 text-gray-700">{SITE_ADDRESS}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Phone</dt>
          <dd className="mt-1">
            <a href={`tel:${SITE_PHONE}`} className="text-gray-700 hover:text-maroon">
              {SITE_PHONE}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Email</dt>
          <dd className="mt-1">
            <a href={`mailto:${SITE_EMAIL}`} className="text-gray-700 hover:text-maroon">
              {SITE_EMAIL}
            </a>
          </dd>
        </div>
      </dl>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
      >
        Get Directions
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/contact/page.tsx"
git commit -m "feat: add Contact page"
```

---

### Task 9: Sitemap and robots

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`

- [ ] **Step 1: Write the sitemap**

```ts
import type { MetadataRoute } from "next";

// Placeholder domain — update once a real domain is chosen (see project notes
// on deferred hosting decisions).
const BASE_URL = "https://mlc.edu.lb";

export default function sitemap(): MetadataRoute.Sitemap {
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
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
```

- [ ] **Step 2: Write robots.ts**

```ts
import type { MetadataRoute } from "next";

// Placeholder domain — update once a real domain is chosen (see project notes
// on deferred hosting decisions).
const BASE_URL = "https://mlc.edu.lb";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all suites still pass (no test touches these files, this just confirms no regression from the whole sub-project).

- [ ] **Step 5: Commit**

```bash
git add src/app/sitemap.ts src/app/robots.ts
git commit -m "feat: add sitemap and robots.txt"
```

---

### Task 10: Manual browser verification

No new files — this is a verification pass across everything built in Tasks 1–9.

- [ ] **Step 1: Desktop nav**

Start the dev server, visit `/`. Confirm the header shows the logo + all 10 nav links, and the footer shows contact info + the same 10 links + copyright. Click through to `/announcements`, `/teachers`, `/about`, `/contact` and confirm the corresponding nav link is visually highlighted (maroon) while on that page, and all others are not.

- [ ] **Step 2: Mobile nav**

Resize the viewport to mobile width (or use the browser tool's mobile preset). Confirm the desktop nav links are hidden and a hamburger button appears. Click it — confirm the mobile panel opens with all 10 links. Click a link — confirm it navigates and the panel closes. Reopen the panel and press Escape — confirm it closes. Reopen the panel and click outside it (e.g. on the main content area) — confirm it closes.

- [ ] **Step 3: Homepage content**

On `/`, confirm the hero renders with both CTA buttons working (`/tours`, `/about`). Confirm "Latest Announcements" and "Achievements" sections render real seeded data (titles/dates/images match what's in `/announcements` and `/achievements`), each capped at 3 items, and each "View All" link navigates correctly.

- [ ] **Step 4: About/Contact**

Visit `/about` — confirm the Mission/Story sections render. Visit `/contact` — confirm address/phone/email render, the phone link has `href="tel:+961 5 000 000"`, the email link has `href="mailto:info@mlc.edu.lb"`, and "Get Directions" opens a Google Maps search URL in a new tab.

- [ ] **Step 5: Sitemap/robots**

Visit `/sitemap.xml` — confirm it lists all 10 routes with the placeholder base URL. Visit `/robots.txt` — confirm it disallows `/admin` and `/api` and references the sitemap URL.

- [ ] **Step 6: Admin unaffected**

Visit `/admin/dashboard/announcements` (or any admin page) — confirm the admin layout (sidebar nav, no public header/footer) still renders exactly as before, unaffected by the `(public)` route group changes.
