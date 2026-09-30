import TeacherForm from "../TeacherForm";
import BackLink from "@/components/admin/BackLink";

export default function NewTeacherPage() {
  return (
    <div>
      <BackLink href="/admin/dashboard/teachers" label="Back to Teachers" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Teacher</h1>
      <TeacherForm mode="create" />
    </div>
  );
}
