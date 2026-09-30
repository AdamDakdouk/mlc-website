import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const posting = await JobPosting.findById(id).lean();
  if (!posting) {
    notFound();
  }

  const applications = await Application.find({ postingId: id })
    .sort({ submittedAt: -1 })
    .lean();

  return (
    <div>
      <BackLink href="/admin/dashboard/careers" label="Back to Careers" />
      <h1 className="mb-2 text-2xl font-semibold text-navy">Applications</h1>
      <p className="mb-6 text-gray-600">{posting.title}</p>
      {applications.length === 0 ? (
        <p className="text-gray-600">No applications yet.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((a) => (
            <div key={a._id.toString()} className="rounded border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-navy">{a.name}</p>
                  <p className="text-sm text-gray-600">
                    {a.email} · {a.phone}
                  </p>
                  <p className="text-xs text-gray-500">
                    Submitted {new Date(a.submittedAt).toLocaleString(undefined, { timeZone: "UTC" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <a
                    href={`/api/admin/careers/applications/${a._id.toString()}/resume`}
                    aria-label={`Download resume for "${a.name}"`}
                    className="text-navy hover:underline"
                  >
                    Download resume
                  </a>
                  <DeleteEntityButton
                    id={a._id.toString()}
                    label={a.name}
                    endpoint="/api/admin/careers/applications"
                  />
                </div>
              </div>
              {a.coverNote && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.coverNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
