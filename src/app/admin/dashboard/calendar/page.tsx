import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

function formatDateRange(startDate: Date, endDate: Date): string {
  const start = startDate.toLocaleDateString(undefined, { timeZone: "UTC" });
  const end = endDate.toLocaleDateString(undefined, { timeZone: "UTC" });
  return start === end ? start : `${start} – ${end}`;
}

export default async function CalendarAdminPage() {
  await connectToDatabase();
  const events = await CalendarEvent.find().sort({ startDate: 1 }).lean();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Academic Calendar</h1>
        <Link
          href="/admin/dashboard/calendar/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-gray-600">No events yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Title
                </th>
                <th scope="col" className="py-2 pr-4">
                  Category
                </th>
                <th scope="col" className="py-2 pr-4">
                  Date
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{e.title}</td>
                  <td className="py-2 pr-4 text-gray-600">{e.category}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {formatDateRange(e.startDate, e.endDate)}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/calendar/${e._id.toString()}/edit`}
                      aria-label={`Edit "${e.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton
                      id={e._id.toString()}
                      label={e.title}
                      endpoint="/api/admin/calendar"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
