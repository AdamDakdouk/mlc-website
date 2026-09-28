"use client";

import { useRef, useState, type ChangeEvent } from "react";

interface FileInputProps {
  id: string;
  name: string;
  accept?: string;
  hint?: string;
}

export default function FileInput({ id, name, accept, hint }: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const hintId = hint ? `${id}-hint` : undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.target.files?.[0]?.name ?? null);
  }

  function handleClear() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setFileName(null);
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        onChange={handleChange}
        aria-describedby={hintId}
        className="sr-only"
      />
      {fileName ? (
        <div className="mt-1 flex items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-sm">
          <span className="truncate text-gray-700">{fileName}</span>
          <button
            type="button"
            onClick={handleClear}
            aria-label={`Remove selected file "${fileName}"`}
            className="ml-2 shrink-0 rounded text-gray-400 transition hover:text-maroon"
          >
            ×
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="mt-1 flex cursor-pointer items-center gap-3 rounded border border-gray-300 px-3 py-2 transition hover:border-navy hover:bg-gray-50"
        >
          <span className="rounded bg-navy px-3 py-1 text-xs font-medium text-white transition hover:bg-navy/90">
            Choose File
          </span>
          <span className="text-sm text-gray-500">No file chosen</span>
        </label>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}
