import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import MeetingRequestActions from "./MeetingRequestActions";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function MeetingRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const meetingRequest = await MeetingRequest.findById(id).lean();

  if (!meetingRequest) {
    notFound();
  }

  return (
    <div className="max-w-lg">
      <BackLink href="/admin/dashboard/meeting-requests" label="Back to Meeting Requests" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">Meeting Request</h1>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-medium text-navy">Parent Name</dt>
          <dd className="text-gray-700">{meetingRequest.parentName}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Email</dt>
          <dd className="text-gray-700">{meetingRequest.parentEmail}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Phone</dt>
          <dd className="text-gray-700">{meetingRequest.parentPhone}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Address</dt>
          <dd className="text-gray-700">{meetingRequest.parentAddress}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Student</dt>
          <dd className="text-gray-700">
            {meetingRequest.studentName} ({meetingRequest.studentGrade})
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Submitted</dt>
          <dd className="text-gray-700">
            {meetingRequest.createdAt.toLocaleString(undefined, { timeZone: "UTC" })}
          </dd>
        </div>
        {meetingRequest.reason && (
          <div>
            <dt className="font-medium text-navy">Message</dt>
            <dd className="whitespace-pre-wrap text-gray-700">{meetingRequest.reason}</dd>
          </div>
        )}
      </dl>
      <div className="mt-8 border-t border-gray-200 pt-6">
        <MeetingRequestActions
          meetingRequestId={meetingRequest._id.toString()}
          status={meetingRequest.status}
        />
      </div>
    </div>
  );
}
