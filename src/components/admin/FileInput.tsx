"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Cropper from "react-easy-crop";
import { cropImageToFile, type PixelCrop } from "@/lib/cropImage";

interface FileInputProps {
  id: string;
  name: string;
  accept?: string;
  hint?: string;
  // When set, choosing an image opens a zoom/crop dialog first, and the
  // cropped result (not the original) is what gets submitted with the form.
  crop?: { aspect: number; round?: boolean };
}

export default function FileInput({ id, name, accept, hint, crop }: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<{ url: string; name: string } | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const hintId = hint ? `${id}-hint` : undefined;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function cancelCrop() {
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
    setCropError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  useEffect(() => {
    if (!cropSource) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") cancelCrop();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropSource]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(null);
      setPreviewUrl(null);
      return;
    }
    if (crop) {
      setPosition({ x: 0, y: 0 });
      setZoom(1);
      setPixelCrop(null);
      setCropError(null);
      setCropSource({ url: URL.createObjectURL(file), name: file.name });
      return;
    }
    setFileName(file.name);
    setPreviewUrl(null);
  }

  async function applyCrop() {
    if (!cropSource || !pixelCrop || !inputRef.current) return;
    try {
      const file = await cropImageToFile(cropSource.url, pixelCrop, cropSource.name);
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
      setFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
      URL.revokeObjectURL(cropSource.url);
      setCropSource(null);
      setCropError(null);
    } catch {
      setCropError("Could not process that image. Try a different file.");
    }
  }

  function handleClear() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setFileName(null);
    setPreviewUrl(null);
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
          <div className="flex min-w-0 items-center gap-3">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected image preview"
                className={`h-12 shrink-0 object-cover ${
                  crop?.round ? "w-12 rounded-full" : "w-auto rounded"
                }`}
              />
            )}
            <span className="truncate text-gray-700">{fileName}</span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            aria-label={`Remove selected file "${fileName}"`}
            className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xl leading-none text-gray-500 transition hover:bg-maroon/10 hover:text-maroon"
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

      {cropSource && crop && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crop image"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <p className="mb-3 text-sm font-medium text-navy">
              Drag to reposition, use the slider to zoom
            </p>
            <div className="relative h-72 w-full overflow-hidden rounded bg-gray-900">
              <Cropper
                image={cropSource.url}
                crop={position}
                zoom={zoom}
                aspect={crop.aspect}
                cropShape={crop.round ? "round" : "rect"}
                onCropChange={setPosition}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setPixelCrop(areaPixels)}
              />
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm text-gray-600">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </label>
            {cropError && (
              <p role="alert" className="mt-2 text-sm text-maroon">
                {cropError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelCrop}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-navy transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={!pixelCrop}
                className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
              >
                Use this crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
