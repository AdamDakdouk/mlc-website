"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface AchievementFormProps {
  mode: "create" | "edit";
  achievementId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialDate?: string;
  initialPhotoUrl?: string | null;
}

export default function AchievementForm({
  mode,
  achievementId,
  initialTitle = "",
  initialDescription = "",
  initialDate = "",
  initialPhotoUrl = null,
}: AchievementFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [date, setDate] = useState(initialDate);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    if (removePhoto) {
      formData.set("removePhoto", "true");
    }

    try {
      const url =
        mode === "create" ? "/api/admin/achievements" : `/api/admin/achievements/${achievementId}`;
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

      router.push("/admin/dashboard/achievements");
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
          name="title"
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
          name="description"
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-navy">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
              className="rounded object-cover"
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
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="photo-hint"
          className="mt-1 w-full text-sm"
        />
        <p id="photo-hint" className="mt-1 text-xs text-gray-500">
          JPEG, PNG, or WebP, max 5MB
        </p>
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
          onClick={() => router.push("/admin/dashboard/achievements")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
