import { notFound } from "next/navigation";
import mongoose from "mongoose";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { SITE_WHISH_CONTACT } from "@/lib/siteContact";
import SessionApplyForm from "./SessionApplyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply for a Session — MLC",
  description: "Apply for a session at Modernistic Learning Community.",
};

export default async function SessionApplyPage({
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

  const teacher = session.teacherId
    ? await Teacher.findById(session.teacherId).select("name").lean()
    : null;

  const spotsRemaining = (session.capacity ?? 0) - (session.applicantCount ?? 0);
  const hasPassed = session.sessionDateTime ? session.sessionDateTime.getTime() <= Date.now() : false;
  const isFull = spotsRemaining <= 0;

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-navy">{session.title}</h1>
      <dl className="mb-8 space-y-1 text-sm text-gray-700">
        <div>
          <dt className="inline font-medium text-navy">Teacher: </dt>
          <dd className="inline">{teacher?.name ?? "TBD"}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-navy">Date &amp; time: </dt>
          <dd className="inline">
            {session.sessionDateTime!.toLocaleString(undefined, {
              timeZone: "UTC",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium text-navy">Duration: </dt>
          <dd className="inline">{session.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt className="inline font-medium text-navy">Price: </dt>
          <dd className="inline">${session.price}</dd>
        </div>
      </dl>

      {hasPassed ? (
        <p className="text-maroon">Applications for this session are closed.</p>
      ) : isFull ? (
        <p className="text-maroon">This session is full.</p>
      ) : (
        <>
          <div className="mb-6 rounded border border-gray-200 bg-cream p-4 text-sm text-gray-700">
            <p className="font-medium text-navy">Payment instructions</p>
            <p className="mt-1">
              Send <strong>${session.price}</strong> via Whish to{" "}
              <strong>{SITE_WHISH_CONTACT}</strong>, then upload a screenshot of the payment below.
            </p>
          </div>
          <SessionApplyForm sessionId={id} />
        </>
      )}
    </div>
  );
}
