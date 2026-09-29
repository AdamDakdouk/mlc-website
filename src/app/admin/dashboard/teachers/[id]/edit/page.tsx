import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import TeacherForm from "../../TeacherForm";

export const dynamic = "force-dynamic";

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const teacher = await Teacher.findById(id).lean();

  if (!teacher) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Teacher</h1>
      <TeacherForm
        mode="edit"
        teacherId={teacher._id.toString()}
        initialName={teacher.name}
        initialEmail={teacher.email}
        initialSubjects={teacher.subjects}
        initialQualifications={teacher.qualifications}
        initialExperience={teacher.experience}
        initialPhotoUrl={teacher.photoUrl}
      />
    </div>
  );
}
