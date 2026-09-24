"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded border border-maroon px-3 py-1.5 text-sm text-maroon transition hover:bg-maroon hover:text-white"
    >
      Log out
    </button>
  );
}
