import JobPostingForm from "../JobPostingForm";
import BackLink from "@/components/admin/BackLink";

export default function NewJobPostingPage() {
  return (
    <div>
      <BackLink href="/admin/dashboard/careers" label="Back to Careers" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Job Posting</h1>
      <JobPostingForm mode="create" />
    </div>
  );
}
