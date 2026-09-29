import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { SessionApplication } from "@/models/SessionApplication";
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

  const rows = await Promise.all(
    events.map(async (e) => ({
      id: e._id.toString(),
      title: e.title,
      category: e.category,
      startDate: e.startDate,
      endDate: e.endDate,
      applicationCount:
        e.category === "Session"
          ? await SessionApplication.countDocuments({ sessionId: e._id })
          : null,
    })),
  );

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
      {rows.length === 0 ? (
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
                <th scope="col" className="py-2 pr-4">
                  Applications
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.category}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {formatDateRange(r.startDate, r.endDate)}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {r.applicationCount === null ? (
                      "—"
                    ) : (
                      <Link
                        href={`/admin/dashboard/calendar/${r.id}/applications`}
                        className="text-navy hover:underline"
                      >
                        {r.applicationCount}
                      </Link>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/calendar/${r.id}/edit`}
                      aria-label={`Edit "${r.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton
                      id={r.id}
                      label={r.title}
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
