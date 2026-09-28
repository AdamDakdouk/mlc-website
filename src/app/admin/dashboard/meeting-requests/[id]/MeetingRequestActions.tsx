"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

interface MeetingRequestActionsProps {
  meetingRequestId: string;
  status: MeetingRequestStatus;
  requestedDateTime: string;
  confirmedDateTime: string | null;
}

export default function MeetingRequestActions({
  meetingRequestId,
  status,
  requestedDateTime,
  confirmedDateTime,
}: MeetingRequestActionsProps) {
  const router = useRouter();
  const [dateTime, setDateTime] = useState(confirmedDateTime ?? requestedDateTime);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "Confirmed" | "Declined") {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/meeting-requests/${meetingRequestId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "Confirmed" ? { confirmedDateTime: dateTime } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/admin/dashboard/meeting-requests");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading) return;
    if (!confirm("Delete this meeting request? This cannot be undone.")) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/meeting-requests/${meetingRequestId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        setLoading(false);
        return;
      }
      router.push("/admin/dashboard/meeting-requests");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Current status: <span className="font-medium text-navy">{status}</span>
      </p>
      <div>
        <label htmlFor="confirmedDateTime" className="block text-sm font-medium text-navy">
          Confirmed date &amp; time
        </label>
        <input
          id="confirmedDateTime"
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-maroon">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => updateStatus("Confirmed")}
          disabled={loading}
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => updateStatus("Declined")}
          disabled={loading}
          className="rounded border border-maroon px-4 py-2 text-sm font-medium text-maroon transition hover:bg-maroon/10 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="ml-auto rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
