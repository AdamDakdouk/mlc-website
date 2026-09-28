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
        toggleRef.current?.focus();
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
