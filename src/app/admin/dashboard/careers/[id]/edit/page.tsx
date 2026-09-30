import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import JobPostingForm from "../../JobPostingForm";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function EditJobPostingPage({
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

  return (
    <div>
      <BackLink href="/admin/dashboard/careers" label="Back to Careers" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Job Posting</h1>
      <JobPostingForm
        mode="edit"
        postingId={posting._id.toString()}
        initialTitle={posting.title}
        initialDescription={posting.description}
        initialRequirements={posting.requirements}
        initialStatus={posting.status}
      />
    </div>
  );
}
