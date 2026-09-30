"use client";

import { useState, type FormEvent } from "react";

const INPUT_CLASS =
  "mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none";

export default function MeetingRequestClient() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body = {
      parentName: formData.get("parentName"),
      parentEmail: formData.get("parentEmail"),
      parentPhone: formData.get("parentPhone"),
      parentAddress: formData.get("parentAddress"),
      studentName: formData.get("studentName"),
      studentGrade: formData.get("studentGrade"),
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
    return <p className="text-navy">Request received — we&apos;ll be in touch to arrange a time.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="parentName" className="block text-sm font-medium text-navy">
          Parent Name
        </label>
        <input id="parentName" name="parentName" type="text" required className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="parentEmail" className="block text-sm font-medium text-navy">
          Email
        </label>
        <input id="parentEmail" name="parentEmail" type="email" required className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="parentPhone" className="block text-sm font-medium text-navy">
          Phone
        </label>
        <input id="parentPhone" name="parentPhone" type="tel" required className={INPUT_CLASS} />
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
          placeholder="e.g. Street, City"
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="studentName" className="block text-sm font-medium text-navy">
          Student Name
        </label>
        <input id="studentName" name="studentName" type="text" required className={INPUT_CLASS} />
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
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-navy">
          Message <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea id="reason" name="reason" rows={4} className={INPUT_CLASS} />
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
  );
}
