"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface AnnouncementFormProps {
  mode: "create" | "edit";
  announcementId?: string;
  initialTitle?: string;
  initialBody?: string;
  initialImageUrl?: string | null;
}

export default function AnnouncementForm({
  mode,
  announcementId,
  initialTitle = "",
  initialBody = "",
  initialImageUrl = null,
}: AnnouncementFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    if (removeImage) {
      formData.set("removeImage", "true");
    }

    try {
      const url =
        mode === "create"
          ? "/api/admin/announcements"
          : `/api/admin/announcements/${announcementId}`;
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

      router.push("/admin/dashboard/announcements");
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
        <label htmlFor="body" className="block text-sm font-medium text-navy">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="image" className="block text-sm font-medium text-navy">
          Image {mode === "edit" && !removeImage && "(leave blank to keep current)"}
        </label>
        {mode === "edit" && initialImageUrl && !removeImage && (
          <div className="mt-2 flex items-center gap-3">
            <Image
              src={initialImageUrl}
              alt=""
              width={64}
              height={64}
              className="rounded object-cover"
            />
            <button
              type="button"
              onClick={() => setRemoveImage(true)}
              className="text-sm text-maroon hover:underline"
            >
              Remove image
            </button>
          </div>
        )}
        {mode === "edit" && removeImage && (
          <p className="mt-2 text-sm text-maroon">
            Image will be removed on save.{" "}
            <button
              type="button"
              onClick={() => setRemoveImage(false)}
              className="underline"
            >
              Undo
            </button>
          </p>
        )}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="image-hint"
          className="mt-1 w-full text-sm"
        />
        <p id="image-hint" className="mt-1 text-xs text-gray-500">
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
          onClick={() => router.push("/admin/dashboard/announcements")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
