import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { Teacher } from "@/models/Teacher";
import type { MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<MeetingRequestStatus, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Confirmed: "bg-navy/10 text-navy",
  Declined: "bg-maroon/10 text-maroon",
};

export default async function MeetingRequestsAdminPage() {
  await connectToDatabase();
  const [requests, teachers] = await Promise.all([
    MeetingRequest.find().sort({ createdAt: -1 }).lean(),
    Teacher.find().select("name").lean(),
  ]);
  const teacherNameById = new Map(teachers.map((t) => [t._id.toString(), t.name]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Meeting Requests</h1>
      {requests.length === 0 ? (
        <p className="text-gray-600">No meeting requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Parent
                </th>
                <th scope="col" className="py-2 pr-4">
                  Student
                </th>
                <th scope="col" className="py-2 pr-4">
                  Teacher
                </th>
                <th scope="col" className="py-2 pr-4">
                  Requested
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
              {requests.map((r) => (
                <tr key={r._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{r.parentName}</td>
                  <td className="py-2 pr-4">{r.studentName}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {teacherNameById.get(r.teacherId.toString()) ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {r.requestedDateTime.toLocaleString(undefined, { timeZone: "UTC" })}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/meeting-requests/${r._id.toString()}`}
                      aria-label={`View meeting request from "${r.parentName}"`}
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
