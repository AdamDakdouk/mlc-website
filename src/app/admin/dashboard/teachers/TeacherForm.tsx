"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SUBJECTS } from "@/lib/subjects";
import FileInput from "@/components/admin/FileInput";

interface TeacherFormProps {
  mode: "create" | "edit";
  teacherId?: string;
  initialName?: string;
  initialEmail?: string;
  initialSubjects?: string[];
  initialQualifications?: string;
  initialExperience?: string;
  initialPhotoUrl?: string | null;
}

export default function TeacherForm({
  mode,
  teacherId,
  initialName = "",
  initialEmail = "",
  initialSubjects = [],
  initialQualifications = "",
  initialExperience = "",
  initialPhotoUrl = null,
}: TeacherFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [subjects, setSubjects] = useState<string[]>(initialSubjects);
  const [qualifications, setQualifications] = useState(initialQualifications);
  const [experience, setExperience] = useState(initialExperience);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSubject(subject: string) {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    // Keep this in sync with the min(1) subjects check in
    // src/app/api/admin/teachers/route.ts and [id]/route.ts — this is just
    // a fast-fail UX shortcut; the server is the source of truth.
    if (subjects.length === 0) {
      setError("Select at least one subject.");
      return;
    }

    setLoading(true);

    const formData = new FormData(event.currentTarget);
    for (const subject of subjects) {
      formData.append("subjects", subject);
    }
    if (removePhoto) {
      formData.set("removePhoto", "true");
    }

    try {
      const url = mode === "create" ? "/api/admin/teachers" : `/api/admin/teachers/${teacherId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/admin/dashboard/teachers");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-navy">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-navy">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <fieldset>
        <legend className="block text-sm font-medium text-navy">Subjects</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {SUBJECTS.map((subject) => (
            <label key={subject} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={subjects.includes(subject)}
                onChange={() => toggleSubject(subject)}
                className="rounded border-gray-300"
              />
              {subject}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="qualifications" className="block text-sm font-medium text-navy">
          Qualifications
        </label>
        <textarea
          id="qualifications"
          name="qualifications"
          rows={3}
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="experience" className="block text-sm font-medium text-navy">
          Experience
        </label>
        <textarea
          id="experience"
          name="experience"
          rows={3}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="photo" className="block text-sm font-medium text-navy">
          Photo {mode === "edit" && !removePhoto && "(leave blank to keep current)"}
        </label>
        {mode === "edit" && initialPhotoUrl && !removePhoto && (
          <div className="mt-2 flex items-center gap-3">
            <Image
              src={initialPhotoUrl}
              alt=""
              width={64}
              height={64}
              className="rounded-full object-cover"
            />
            <button
              type="button"
              onClick={() => setRemovePhoto(true)}
              className="text-sm text-maroon hover:underline"
            >
              Remove photo
            </button>
          </div>
        )}
        {mode === "edit" && removePhoto && (
          <p className="mt-2 text-sm text-maroon">
            Photo will be removed on save.{" "}
            <button type="button" onClick={() => setRemovePhoto(false)} className="underline">
              Undo
            </button>
          </p>
        )}
        <FileInput
          id="photo"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          hint="JPEG, PNG, or WebP, max 5MB"
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
          onClick={() => router.push("/admin/dashboard/teachers")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
