import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import CalendarEventForm from "../../CalendarEventForm";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function EditCalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const [event, teachers] = await Promise.all([
    CalendarEvent.findById(id).lean(),
    Teacher.find().select("name").sort({ order: 1 }).lean(),
  ]);

  if (!event) {
    notFound();
  }

  const teacherOptions = teachers.map((t) => ({ id: t._id.toString(), name: t.name }));

  return (
    <div>
      <BackLink href="/admin/dashboard/calendar" label="Back to Academic Calendar" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Calendar Event</h1>
      <CalendarEventForm
        mode="edit"
        eventId={event._id.toString()}
        teachers={teacherOptions}
        initialTitle={event.title}
        initialCategory={event.category}
        initialStartDate={event.startDate.toISOString().slice(0, 10)}
        initialEndDate={event.endDate.toISOString().slice(0, 10)}
        initialDescription={event.description}
        initialTeacherId={event.teacherId?.toString() ?? ""}
        initialSessionDateTime={event.sessionDateTime?.toISOString().slice(0, 16) ?? ""}
        initialDurationMinutes={event.durationMinutes}
        initialCapacity={event.capacity}
        initialPrice={event.price}
      />
    </div>
  );
}
