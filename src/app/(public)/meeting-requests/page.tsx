import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import MeetingRequestClient from "./MeetingRequestClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request a Meeting — MLC",
  description: "Request a meeting with a teacher at Modernistic Learning Community.",
};

export default async function MeetingRequestsPage() {
  await connectToDatabase();
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

  const options = teachers.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    photoUrl: t.photoUrl,
    subjects: t.subjects,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-navy">Request a Meeting</h1>
      <p className="mb-8 text-gray-600">
        Pick a teacher and tell us when works for you — we&apos;ll confirm a time.
      </p>
      <MeetingRequestClient teachers={options} />
    </div>
  );
}
