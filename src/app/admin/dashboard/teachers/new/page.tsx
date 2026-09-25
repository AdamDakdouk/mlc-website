import TeacherForm from "../TeacherForm";

export default function NewTeacherPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Teacher</h1>
      <TeacherForm mode="create" />
    </div>
  );
}
