"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";

interface TeacherOption {
  id: string;
  name: string;
  photoUrl: string | null;
  subjects: string[];
}

interface MeetingRequestClientProps {
  teachers: TeacherOption[];
}

export default function MeetingRequestClient({ teachers }: MeetingRequestClientProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleTeacherKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (teachers.length === 0) return;

    const currentIndex = teachers.findIndex((t) => t.id === selectedTeacherId);

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % teachers.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = currentIndex === -1 ? teachers.length - 1 : (currentIndex - 1 + teachers.length) % teachers.length;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    setSelectedTeacherId(teachers[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (!selectedTeacherId) {
      setError("Please select a teacher.");
      return;
    }

    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body = {
      teacherId: selectedTeacherId,
      parentName: formData.get("parentName"),
      parentEmail: formData.get("parentEmail"),
      parentPhone: formData.get("parentPhone"),
      parentAddress: formData.get("parentAddress"),
      studentName: formData.get("studentName"),
      studentGrade: formData.get("studentGrade"),
      requestedDateTime: formData.get("requestedDateTime"),
      reason: formData.get("reason") ?? "",
    };

    try {
      const res = await fetch("/api/meeting-requests/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (submitted) {
    return <p className="text-navy">Request received — we&apos;ll be in touch to confirm.</p>;
  }

  return (
    <div>
      <fieldset>
        <legend className="mb-3 block text-sm font-medium text-navy">Select a teacher</legend>
        {teachers.length === 0 ? (
          <p className="text-gray-600">No teachers to show yet.</p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Select a teacher"
            onKeyDown={handleTeacherKeyDown}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {teachers.map((t, index) => {
              const selected = t.id === selectedTeacherId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected || (!selectedTeacherId && index === 0) ? 0 : -1}
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  onClick={() => setSelectedTeacherId(t.id)}
                  className={`rounded-lg border p-4 text-left transition ${
                    selected ? "border-navy bg-navy/5" : "border-gray-200 hover:border-navy/50"
                  }`}
                >
                  <div className="mb-3 flex justify-center">
                    {t.photoUrl ? (
                      <Image
                        src={t.photoUrl}
                        alt={t.name}
                        width={64}
                        height={64}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-navy/10 text-xl text-navy"
                      >
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="text-center text-sm font-semibold text-navy">{t.name}</p>
                  <p className="mt-1 text-center text-xs text-maroon">{t.subjects.join(", ")}</p>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <form onSubmit={handleSubmit} className="mt-8 max-w-lg space-y-4">
        <div>
          <label htmlFor="parentName" className="block text-sm font-medium text-navy">
            Parent Name
          </label>
          <input
            id="parentName"
            name="parentName"
            type="text"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="parentEmail" className="block text-sm font-medium text-navy">
            Email
          </label>
          <input
            id="parentEmail"
            name="parentEmail"
            type="email"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="parentPhone" className="block text-sm font-medium text-navy">
            Phone
          </label>
          <input
            id="parentPhone"
            name="parentPhone"
            type="tel"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="parentAddress" className="block text-sm font-medium text-navy">
            Address
          </label>
          <input
            id="parentAddress"
            name="parentAddress"
            type="text"
            required
            placeholder="e.g. Street, Building, City"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="studentName" className="block text-sm font-medium text-navy">
            Student Name
          </label>
          <input
            id="studentName"
            name="studentName"
            type="text"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="studentGrade" className="block text-sm font-medium text-navy">
            Grade / Class
          </label>
          <input
            id="studentGrade"
            name="studentGrade"
            type="text"
            required
            placeholder="e.g. Grade 5"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="requestedDateTime" className="block text-sm font-medium text-navy">
            Preferred date &amp; time
          </label>
          <input
            id="requestedDateTime"
            name="requestedDateTime"
            type="datetime-local"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-navy">
            Reason <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-maroon">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Request Meeting"}
        </button>
      </form>
    </div>
  );
}
