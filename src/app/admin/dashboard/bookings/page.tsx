import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";
import type { TourBookingStatus } from "@/lib/tourBookingStatuses";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<TourBookingStatus, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Confirmed: "bg-navy/10 text-navy",
  Declined: "bg-maroon/10 text-maroon",
};

export default async function BookingsAdminPage() {
  await connectToDatabase();
  const bookings = await TourBooking.find().sort({ createdAt: -1 }).lean();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Bookings</h1>
      {bookings.length === 0 ? (
        <p className="text-gray-600">No booking requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4">
                  Requested
                </th>
                <th scope="col" className="py-2 pr-4">
                  Visitors
                </th>
                <th scope="col" className="py-2 pr-4">
                  Status
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{b.name}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {b.requestedDateTime.toLocaleString(undefined, { timeZone: "UTC" })}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{b.numberOfVisitors}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[b.status]}`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/bookings/${b._id.toString()}`}
                      aria-label={`View booking from "${b.name}"`}
                      className="text-navy hover:underline"
                    >
                      View
                    </Link>
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
