"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/calendarCategories";

interface CalendarEventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  initialTitle?: string;
  initialCategory?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialDescription?: string;
}

export default function CalendarEventForm({
  mode,
  eventId,
  initialTitle = "",
  initialCategory = CATEGORIES[0],
  initialStartDate = "",
  initialEndDate = "",
  initialDescription = "",
}: CalendarEventFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const body = {
      title,
      category,
      startDate,
      endDate: endDate || undefined,
      description,
    };

    try {
      const url = mode === "create" ? "/api/admin/calendar" : `/api/admin/calendar/${eventId}`;
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

      router.push("/admin/dashboard/calendar");
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
        <label htmlFor="category" className="block text-sm font-medium text-navy">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="startDate" className="block text-sm font-medium text-navy">
            Start date
          </label>
          <input
            id="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="endDate" className="block text-sm font-medium text-navy">
            End date <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-navy">
          Description <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          type="submit"
          disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/dashboard/calendar")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
