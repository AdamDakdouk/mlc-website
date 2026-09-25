"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAnnouncementButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (loading) return;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete announcement.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        onClick={handleDelete}
        disabled={loading}
        aria-label={`Delete "${title}"`}
        className="text-maroon hover:underline disabled:opacity-50"
      >
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-xs text-maroon">
          {error}
        </span>
      )}
    </span>
  );
}
