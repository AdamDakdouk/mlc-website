"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`block rounded px-3 py-2 text-sm transition ${
        isActive ? "bg-white/15 font-medium" : "hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}
