import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Announcements — MLC",
  description: "Latest announcements and updates from Modernistic Learning Community.",
};

const PAGE_SIZE = 10;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  await connectToDatabase();
  const total = await Announcement.countDocuments();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const announcements = await Announcement.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Announcements</h1>
      {total === 0 ? (
        <p className="text-gray-600">No announcements yet.</p>
      ) : (
        <div className="space-y-8">
          {announcements.map((a) => (
            <article key={a._id.toString()} className="border-b border-gray-200 pb-8">
              {a.imageUrl && (
                <Image
                  src={a.imageUrl}
                  alt={a.title}
                  width={640}
                  height={360}
                  className="mb-4 w-full rounded object-cover"
                />
              )}
              <h2 className="text-xl font-semibold text-navy">{a.title}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {new Date(a.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-gray-700">{a.body}</p>
            </article>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="mt-8 flex justify-center gap-4">
          {page > 1 && (
            <Link href={`/announcements?page=${page - 1}`} className="text-navy hover:underline">
              ← Newer
            </Link>
          )}
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/announcements?page=${page + 1}`} className="text-navy hover:underline">
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
