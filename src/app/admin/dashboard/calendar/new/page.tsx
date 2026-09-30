import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import CalendarEventForm from "../CalendarEventForm";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function NewCalendarEventPage() {
  await connectToDatabase();
  const teachers = await Teacher.find().select("name").sort({ order: 1 }).lean();
  const teacherOptions = teachers.map((t) => ({ id: t._id.toString(), name: t.name }));

  return (
    <div>
      <BackLink href="/admin/dashboard/calendar" label="Back to Academic Calendar" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Calendar Event</h1>
      <CalendarEventForm mode="create" teachers={teacherOptions} />
    </div>
  );
}
