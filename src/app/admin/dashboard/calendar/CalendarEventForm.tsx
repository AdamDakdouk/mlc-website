"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/calendarCategories";

interface TeacherOption {
  id: string;
  name: string;
}

interface CalendarEventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  teachers: TeacherOption[];
  initialTitle?: string;
  initialCategory?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialDescription?: string;
  initialTeacherId?: string;
  initialSessionDateTime?: string;
  initialDurationMinutes?: number;
  initialCapacity?: number;
  initialPrice?: number;
}

export default function CalendarEventForm({
  mode,
  eventId,
  teachers,
  initialTitle = "",
  initialCategory = CATEGORIES[0],
  initialStartDate = "",
  initialEndDate = "",
  initialDescription = "",
  initialTeacherId = "",
  initialSessionDateTime = "",
  initialDurationMinutes,
  initialCapacity,
  initialPrice,
}: CalendarEventFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [description, setDescription] = useState(initialDescription);
  const [teacherId, setTeacherId] = useState(initialTeacherId || teachers[0]?.id || "");
  const [sessionDateTime, setSessionDateTime] = useState(initialSessionDateTime);
  const [durationMinutes, setDurationMinutes] = useState(
    initialDurationMinutes?.toString() ?? "",
  );
  const [capacity, setCapacity] = useState(initialCapacity?.toString() ?? "");
  const [price, setPrice] = useState(initialPrice?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSession = category === "Session";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      title,
      category,
      description,
    };

    if (isSession) {
      body.startDate = sessionDateTime ? sessionDateTime.slice(0, 10) : "";
      body.teacherId = teacherId;
      body.sessionDateTime = sessionDateTime;
      body.durationMinutes = durationMinutes ? Number(durationMinutes) : undefined;
      body.capacity = capacity ? Number(capacity) : undefined;
      body.price = price ? Number(price) : undefined;
    } else {
      body.startDate = startDate;
      body.endDate = endDate || undefined;
    }

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

      {isSession ? (
        <>
          <div>
            <label htmlFor="teacherId" className="block text-sm font-medium text-navy">
              Teacher
            </label>
            <select
              id="teacherId"
              required
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
            >
              {teachers.length === 0 && <option value="">No teachers available</option>}
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sessionDateTime" className="block text-sm font-medium text-navy">
              Date &amp; time
            </label>
            <input
              id="sessionDateTime"
              type="datetime-local"
              required
              value={sessionDateTime}
              onChange={(e) => setSessionDateTime(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="durationMinutes" className="block text-sm font-medium text-navy">
                Duration (minutes)
              </label>
              <input
                id="durationMinutes"
                type="number"
                min={1}
                max={480}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="capacity" className="block text-sm font-medium text-navy">
                Capacity
              </label>
              <input
                id="capacity"
                type="number"
                min={1}
                max={500}
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="price" className="block text-sm font-medium text-navy">
                Price (USD)
              </label>
              <input
                id="price"
                type="number"
                min={0}
                max={100000}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
              />
            </div>
          </div>
        </>
      ) : (
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
      )}

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
