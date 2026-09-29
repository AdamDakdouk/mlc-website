"use client";

import { useState } from "react";
import Link from "next/link";
import type { GridDay, GridEvent } from "./monthUtils";
import { CATEGORY_BG_CLASS, CATEGORY_TEXT_CLASS, type Category } from "@/lib/calendarCategories";

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
                      className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${CATEGORY_TEXT_CLASS[event.category as Category]} ${CATEGORY_BG_CLASS[event.category as Category]}`}
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
              className={`block w-full rounded px-3 py-2 text-left text-sm ${CATEGORY_TEXT_CLASS[event.category as Category]} ${CATEGORY_BG_CLASS[event.category as Category]}`}
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
                {selected.category === "Session" && selected.sessionDateTime
                  ? new Date(selected.sessionDateTime).toLocaleString(undefined, {
                      timeZone: "UTC",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : selected.startDate === selected.endDate
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
          {selected.category === "Session" && (
            <SessionDetails event={selected} />
          )}
        </div>
      )}
    </div>
  );
}

function SessionDetails({ event }: { event: GridEvent }) {
  const capacity = event.capacity ?? 0;
  const applicantCount = event.applicantCount ?? 0;
  const spotsRemaining = capacity - applicantCount;
  const isFull = spotsRemaining <= 0;
  const hasPassed = event.sessionDateTime ? new Date(event.sessionDateTime).getTime() <= Date.now() : false;

  return (
    <dl className="mt-3 space-y-1 text-sm text-gray-700">
      <div>
        <dt className="inline font-medium text-navy">Teacher: </dt>
        <dd className="inline">{event.teacherName}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-navy">Duration: </dt>
        <dd className="inline">{event.durationMinutes} minutes</dd>
      </div>
      <div>
        <dt className="inline font-medium text-navy">Price: </dt>
        <dd className="inline">${event.price}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-navy">Spots remaining: </dt>
        <dd className="inline">{Math.max(0, spotsRemaining)}</dd>
      </div>
      <div className="pt-2">
        {hasPassed ? (
          <span className="text-maroon">Applications closed</span>
        ) : isFull ? (
          <span className="text-maroon">Session full</span>
        ) : (
          <Link
            href={`/calendar/${event.id}/apply`}
            className="inline-block rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
          >
            Apply
          </Link>
        )}
      </div>
    </dl>
  );
}
