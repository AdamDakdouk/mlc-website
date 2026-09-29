import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { SessionApplication } from "@/models/SessionApplication";
import SessionApplicationActions from "./SessionApplicationActions";
import type { SessionApplicationStatus } from "@/lib/sessionApplicationStatuses";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<SessionApplicationStatus, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Verified: "bg-navy/10 text-navy",
  Rejected: "bg-maroon/10 text-maroon",
};

export default async function SessionApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const session = await CalendarEvent.findById(id).lean();
  if (!session || session.category !== "Session") {
    notFound();
  }

  const applications = await SessionApplication.find({ sessionId: id })
    .sort({ submittedAt: -1 })
    .lean();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-navy">Applications</h1>
      <p className="mb-6 text-gray-600">
        {session.title} — {session.applicantCount}/{session.capacity} spots reserved
      </p>
      {applications.length === 0 ? (
        <p className="text-gray-600">No applications yet.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((a) => (
            <div key={a._id.toString()} className="rounded border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-navy">{a.name}</p>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[a.status]}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {a.email} · {a.phone}
                  </p>
                  <p className="text-sm text-gray-600">{a.address}</p>
                  <p className="text-xs text-gray-500">
                    Submitted {new Date(a.submittedAt).toLocaleString(undefined, { timeZone: "UTC" })}
                  </p>
                  <a
                    href={`/api/admin/calendar/applications/${a._id.toString()}/payment-proof`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View payment proof for "${a.name}"`}
                    className="mt-1 inline-block text-sm text-navy hover:underline"
                  >
                    View payment proof
                  </a>
                </div>
                <SessionApplicationActions
                  applicationId={a._id.toString()}
                  status={a.status}
                  applicantLabel={a.name}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
