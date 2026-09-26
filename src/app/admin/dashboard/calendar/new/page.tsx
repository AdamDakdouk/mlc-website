import CalendarEventForm from "../CalendarEventForm";

export default function NewCalendarEventPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Calendar Event</h1>
      <CalendarEventForm mode="create" />
    </div>
  );
}
