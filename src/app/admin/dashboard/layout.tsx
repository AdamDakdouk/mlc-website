import type { ReactNode } from "react";
import Image from "next/image";
import LogoutButton from "./LogoutButton";
import NavLink from "./NavLink";

const NAV_ITEMS = [
  { href: "/admin/dashboard/announcements", label: "Announcements" },
  { href: "/admin/dashboard/teachers", label: "Teachers" },
  { href: "/admin/dashboard/calendar", label: "Academic Calendar" },
  { href: "/admin/dashboard/careers", label: "Careers" },
  { href: "/admin/dashboard/bookings", label: "Bookings" },
  { href: "/admin/dashboard/achievements", label: "Achievements" },
  { href: "/admin/dashboard/meeting-requests", label: "Meeting Requests" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="w-64 flex-shrink-0 bg-navy text-white">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <Image src="/images/logo.jpg" alt="MLC logo" width={40} height={40} className="rounded-full" />
          <span className="font-semibold">MLC Admin</span>
        </div>
        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-gray-200 bg-white p-4">
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
