import Link from "next/link";
import { SITE_ADDRESS, SITE_EMAIL, SITE_PHONE } from "@/lib/siteContact";

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
