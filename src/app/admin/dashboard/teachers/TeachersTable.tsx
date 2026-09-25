"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

interface TeacherRow {
  id: string;
  name: string;
  subjects: string[];
  photoUrl: string | null;
}

function SortableRow({ row }: { row: TeacherRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-100 bg-white">
      <td className="w-8 py-2 pr-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder "${row.name}"`}
          className="cursor-grab text-gray-400 hover:text-navy active:cursor-grabbing"
        >
          ⠿
        </button>
      </td>
      <td className="py-2 pr-4">
        {row.photoUrl ? (
          <Image
            src={row.photoUrl}
            alt={row.name}
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-xs text-navy">
            {row.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </td>
      <td className="py-2 pr-4">{row.name}</td>
      <td className="py-2 pr-4 text-gray-600">{row.subjects.join(", ")}</td>
      <td className="py-2 text-right">
        <Link
          href={`/admin/dashboard/teachers/${row.id}/edit`}
          aria-label={`Edit "${row.name}"`}
          className="mr-3 text-navy hover:underline"
        >
          Edit
        </Link>
        <DeleteEntityButton id={row.id} label={row.name} endpoint="/api/admin/teachers" />
      </td>
    </tr>
  );
}

export default function TeachersTable({ initialRows }: { initialRows: TeacherRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    const reordered = [...rows];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setRows(reordered);
    setError(null);

    try {
      const res = await fetch("/api/admin/teachers/reorder", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
      });
      if (!res.ok) {
        setError("Failed to save the new order.");
        setRows(initialRows);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setRows(initialRows);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-2 text-sm text-maroon">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        {/*
          DndContext must wrap the whole <table>, not sit inside <tbody>:
          it renders its own screen-reader-only accessibility markup (a
          hidden description + live region) as a sibling of its children,
          and <tbody> may only contain <tr> elements. Nesting it inside
          <tbody> causes an invalid-HTML / hydration warning in the
          console. SortableContext renders no DOM of its own, so it can
          stay scoped to just the rows.
        */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-2">
                  <span className="sr-only">Reorder</span>
                </th>
                <th scope="col" className="py-2 pr-4">
                  Photo
                </th>
                <th scope="col" className="py-2 pr-4">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4">
                  Subjects
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                {rows.map((row) => (
                  <SortableRow key={row.id} row={row} />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
