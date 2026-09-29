import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { parseMonthParam, formatMonthParam, adjacentMonth, buildMonthGrid } from "./monthUtils";
import CalendarGrid from "./CalendarGrid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Academic Calendar — MLC",
  description: "Academic dates, holidays, and events at Modernistic Learning Community.",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const current = parseMonthParam(monthParam);
  const previous = adjacentMonth(current, -1);
  const next = adjacentMonth(current, 1);

  await connectToDatabase();
  // Fetch anything that could overlap the visible 42-day grid, not just
  // events strictly inside the calendar month — the grid shows trailing
  // days from the previous month and leading days from the next.
  const rangeStart = new Date(Date.UTC(previous.year, previous.month - 1, 1));
  const rangeEnd = new Date(Date.UTC(next.year, next.month, 0));
  const [events, teachers] = await Promise.all([
    CalendarEvent.find({
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
    })
      .sort({ startDate: 1 })
      .lean(),
    Teacher.find().select("name").lean(),
  ]);
  const teacherNameById = new Map(teachers.map((t) => [t._id.toString(), t.name]));

  const eventsForGrid = events.map((e) => ({
    id: e._id.toString(),
    title: e.title,
    category: e.category,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate.toISOString().slice(0, 10),
    description: e.description,
    ...(e.category === "Session"
      ? {
          teacherName: e.teacherId ? (teacherNameById.get(e.teacherId.toString()) ?? "TBD") : "TBD",
          sessionDateTime: e.sessionDateTime!.toISOString(),
          durationMinutes: e.durationMinutes,
          price: e.price,
          capacity: e.capacity,
          applicantCount: e.applicantCount,
        }
      : {}),
  }));

  const days = buildMonthGrid(current, eventsForGrid);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-navy">
          {MONTH_NAMES[current.month - 1]} {current.year}
        </h1>
        <div className="flex gap-3 text-sm">
          <Link
            href={`/calendar?month=${formatMonthParam(previous)}`}
            className="rounded border border-gray-300 px-3 py-1.5 text-navy hover:bg-gray-50"
          >
            ← Previous
          </Link>
          <Link
            href={`/calendar?month=${formatMonthParam(next)}`}
            className="rounded border border-gray-300 px-3 py-1.5 text-navy hover:bg-gray-50"
          >
            Next →
          </Link>
        </div>
      </div>
      <CalendarGrid days={days} />
    </div>
  );
}
