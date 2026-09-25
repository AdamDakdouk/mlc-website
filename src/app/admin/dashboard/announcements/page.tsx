import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function AnnouncementsAdminPage() {
  await connectToDatabase();
  // .lean() here is safe to read _id/createdAt as real ObjectId/Date
  // instances (not strings) because this renders server-side with no JSON
  // boundary in between — this would need explicit serialization if this
  // pattern were ever reused for an API response instead.
  const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Announcements</h1>
        <Link
          href="/admin/dashboard/announcements/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {announcements.length === 0 ? (
        <p className="text-gray-600">No announcements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Title
                </th>
                <th scope="col" className="py-2 pr-4">
                  Date
                </th>
                <th scope="col" className="py-2 pr-4">
                  Image
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((a) => (
                <tr key={a._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{a.title}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4">{a.imageUrl ? "Yes" : "—"}</td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/announcements/${a._id.toString()}/edit`}
                      aria-label={`Edit "${a.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton
                      id={a._id.toString()}
                      label={a.title}
                      endpoint="/api/admin/announcements"
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
