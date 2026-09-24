"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Network failure on logout: still proceed to clear client state and
      // redirect — the cookie may or may not have cleared server-side, but
      // sending the user back to /admin/login is the safe default either way.
    }
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded border border-maroon px-3 py-1.5 text-sm text-maroon transition hover:bg-maroon hover:text-white disabled:opacity-50"
    >
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}
