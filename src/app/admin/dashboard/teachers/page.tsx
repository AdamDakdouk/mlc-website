import Image from "next/image";
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function TeachersAdminPage() {
  await connectToDatabase();
  // .lean() is safe here: only plain strings/numbers and this record's own
  // ObjectId/Dates are read, and nothing crosses a JSON boundary — this page
  // renders entirely server-side before any client hydration.
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

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
      {teachers.length === 0 ? (
        <p className="text-gray-600">No teachers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Photo
                </th>
                <th scope="col" className="py-2 pr-4">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4">
                  Subjects
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">
                    {t.photoUrl ? (
                      <Image
                        src={t.photoUrl}
                        alt={t.name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-xs text-navy"
                      >
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">{t.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{t.subjects.join(", ")}</td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/teachers/${t._id.toString()}/edit`}
                      aria-label={`Edit "${t.name}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton
                      id={t._id.toString()}
                      label={t.name}
                      endpoint="/api/admin/teachers"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
