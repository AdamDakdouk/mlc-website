"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionApplicationStatus } from "@/lib/sessionApplicationStatuses";

interface SessionApplicationActionsProps {
  applicationId: string;
  status: SessionApplicationStatus;
  applicantLabel: string;
}

export default function SessionApplicationActions({
  applicationId,
  status,
  applicantLabel,
}: SessionApplicationActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "Verified" | "Rejected") {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/calendar/applications/${applicationId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading) return;
    const confirmMessage =
      status === "Rejected"
        ? `Delete this application from "${applicantLabel}"? This cannot be undone.`
        : `Delete this application from "${applicantLabel}"? This cannot be undone and will free up their spot in the session.`;
    if (!confirm(confirmMessage)) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/calendar/applications/${applicationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  if (status !== "Pending") {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600">{status}</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          aria-label={`Delete application from "${applicantLabel}"`}
          className="text-maroon hover:underline disabled:opacity-50"
        >
          Delete
        </button>
        {error && (
          <span role="alert" className="text-xs text-maroon">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => updateStatus("Verified")}
          disabled={loading}
          aria-label={`Verify application from "${applicantLabel}"`}
          className="rounded bg-navy px-3 py-1 text-xs font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          Verify
        </button>
        <button
          type="button"
          onClick={() => updateStatus("Rejected")}
          disabled={loading}
          aria-label={`Reject application from "${applicantLabel}"`}
          className="rounded border border-maroon px-3 py-1 text-xs font-medium text-maroon transition hover:bg-maroon/10 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          aria-label={`Delete application from "${applicantLabel}"`}
          className="text-maroon hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-maroon">
          {error}
        </span>
      )}
    </div>
  );
}
