import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import CalendarEventForm from "../../CalendarEventForm";

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
  const event = await CalendarEvent.findById(id).lean();

  if (!event) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Calendar Event</h1>
      <CalendarEventForm
        mode="edit"
        eventId={event._id.toString()}
        initialTitle={event.title}
        initialCategory={event.category}
        initialStartDate={event.startDate.toISOString().slice(0, 10)}
        initialEndDate={event.endDate.toISOString().slice(0, 10)}
        initialDescription={event.description}
      />
    </div>
  );
}
