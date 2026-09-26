"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface JobPostingFormProps {
  mode: "create" | "edit";
  postingId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialRequirements?: string;
  initialStatus?: "Open" | "Closed";
}

export default function JobPostingForm({
  mode,
  postingId,
  initialTitle = "",
  initialDescription = "",
  initialRequirements = "",
  initialStatus = "Open",
}: JobPostingFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [status, setStatus] = useState<"Open" | "Closed">(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const body = { title, description, requirements, status };

    try {
      const url = mode === "create" ? "/api/admin/careers" : `/api/admin/careers/${postingId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/admin/dashboard/careers");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-navy">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-navy">
          Description
        </label>
        <textarea
          id="description"
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="requirements" className="block text-sm font-medium text-navy">
          Requirements <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="requirements"
          rows={4}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-navy">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "Open" | "Closed")}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        >
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-maroon">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/dashboard/careers")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
