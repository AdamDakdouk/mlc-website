import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function CareersAdminPage() {
  await connectToDatabase();
  const postings = await JobPosting.find().sort({ createdAt: -1 }).lean();

  const rows = await Promise.all(
    postings.map(async (p) => ({
      id: p._id.toString(),
      title: p.title,
      status: p.status,
      applicationCount: await Application.countDocuments({ postingId: p._id }),
    })),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Careers</h1>
        <Link
          href="/admin/dashboard/careers/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-600">No postings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Title
                </th>
                <th scope="col" className="py-2 pr-4">
                  Status
                </th>
                <th scope="col" className="py-2 pr-4">
                  Applications
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.status}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    <Link
                      href={`/admin/dashboard/careers/${r.id}/applications`}
                      className="text-navy hover:underline"
                    >
                      {r.applicationCount}
                    </Link>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/careers/${r.id}/edit`}
                      aria-label={`Edit "${r.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton id={r.id} label={r.title} endpoint="/api/admin/careers" />
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
