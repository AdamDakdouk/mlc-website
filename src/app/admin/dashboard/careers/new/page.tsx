import JobPostingForm from "../JobPostingForm";

export default function NewJobPostingPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Job Posting</h1>
      <JobPostingForm mode="create" />
    </div>
  );
}
