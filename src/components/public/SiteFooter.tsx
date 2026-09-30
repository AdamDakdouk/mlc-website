import Link from "next/link";
import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_FACEBOOK_URL,
  SITE_INSTAGRAM_URL,
  SITE_PHONE,
  SITE_PHONE_HREF,
} from "@/lib/siteContact";

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/announcements", label: "Announcements" },
  { href: "/teachers", label: "Teachers" },
  { href: "/calendar", label: "Academic Calendar" },
  { href: "/careers", label: "Careers" },
  { href: "/achievements", label: "Achievements" },
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
                <a
                  href={SITE_PHONE_HREF}
                  className="text-navy underline underline-offset-2 transition hover:text-maroon"
                >
                  {SITE_PHONE}
                </a>
              </p>
              <p>
                <a
                  href={`mailto:${SITE_EMAIL}`}
                  className="text-navy underline underline-offset-2 transition hover:text-maroon"
                >
                  {SITE_EMAIL}
                </a>
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={SITE_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MLC on Instagram"
                className="text-navy transition hover:text-maroon"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href={SITE_FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MLC on Facebook"
                className="text-navy transition hover:text-maroon"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
                  <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" />
                </svg>
              </a>
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
