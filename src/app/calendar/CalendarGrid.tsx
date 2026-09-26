"use client";

import { useState } from "react";
import type { GridDay, GridEvent } from "./monthUtils";
import { CATEGORY_BG_CLASS, type Category } from "@/lib/calendarCategories";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({ days }: { days: GridDay[] }) {
  const [selected, setSelected] = useState<GridEvent | null>(null);

  const monthEvents = Array.from(
    new Map(
      days
        .filter((d) => d.inMonth)
        .flatMap((d) => d.events)
        .map((e) => [e.id, e]),
    ).values(),
  );

  return (
    <div>
      {/* Month grid: hidden on narrow screens in favor of the list below. */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px bg-gray-200 text-xs font-medium text-navy">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-cream p-2 text-center">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {days.map((day) => (
            <div
              key={day.date}
              className={`min-h-24 bg-white p-1 ${day.inMonth ? "" : "bg-gray-50 text-gray-400"}`}
            >
              <span className="text-xs">{Number(day.date.slice(8, 10))}</span>
              <div className="mt-1 space-y-0.5">
                {day.events.map((event) =>
                  event.isStart ? (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelected(event)}
                      className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white ${CATEGORY_BG_CLASS[event.category as Category]}`}
                    >
                      {event.title}
                    </button>
                  ) : (
                    <div
                      key={event.id}
                      aria-hidden="true"
                      className={`block h-4 w-full rounded ${CATEGORY_BG_CLASS[event.category as Category]}`}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile fallback: a plain stacked list instead of a cramped grid. */}
      <ul className="space-y-2 sm:hidden">
        {monthEvents.length === 0 && <li className="text-sm text-gray-600">No events this month.</li>}
        {monthEvents.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => setSelected(event)}
              className={`block w-full rounded px-3 py-2 text-left text-sm text-white ${CATEGORY_BG_CLASS[event.category as Category]}`}
            >
              <span className="font-medium">{event.title}</span>
              <span className="ml-2 text-xs opacity-90">
                {event.startDate === event.endDate
                  ? event.startDate
                  : `${event.startDate} – ${event.endDate}`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-4 rounded border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-navy">{selected.title}</h3>
              <p className="text-sm text-gray-600">
                {selected.startDate === selected.endDate
                  ? selected.startDate
                  : `${selected.startDate} – ${selected.endDate}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close event details"
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          {selected.description && <p className="mt-2 text-sm text-gray-700">{selected.description}</p>}
        </div>
      )}
    </div>
  );
}
