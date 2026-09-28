import { notFound } from "next/navigation";
import mongoose from "mongoose";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import ApplicationForm from "./ApplicationForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return { title: "Careers — MLC" };
  }
  await connectToDatabase();
  const posting = await JobPosting.findById(id).lean();
  return { title: posting ? `${posting.title} — Careers — MLC` : "Careers — MLC" };
}

export default async function JobPostingDetailPage({
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

  if (!posting || posting.status !== "Open") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-navy">{posting.title}</h1>
      <div className="mt-6 whitespace-pre-wrap text-gray-700">{posting.description}</div>
      {posting.requirements && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-navy">Requirements</h2>
          <div className="mt-2 whitespace-pre-wrap text-gray-700">{posting.requirements}</div>
        </div>
      )}
      <div className="mt-10 border-t border-gray-200 pt-8">
        <h2 className="mb-4 text-lg font-semibold text-navy">Apply</h2>
        <ApplicationForm postingId={posting._id.toString()} />
      </div>
    </div>
  );
}
