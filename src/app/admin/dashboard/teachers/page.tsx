import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import TeachersTable from "./TeachersTable";

export const dynamic = "force-dynamic";

export default async function TeachersAdminPage() {
  await connectToDatabase();
  // .lean() is safe here: only plain strings/numbers and this record's own
  // ObjectId/Dates are read, and nothing crosses a JSON boundary — this page
  // renders entirely server-side before any client hydration.
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

  const rows = teachers.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    email: t.email,
    subjects: t.subjects,
    photoUrl: t.photoUrl,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Teachers</h1>
        <Link
          href="/admin/dashboard/teachers/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-600">No teachers yet.</p>
      ) : (
        <TeachersTable initialRows={rows} />
      )}
    </div>
  );
}
