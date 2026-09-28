import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Careers — MLC",
  description: "Open positions at Modernistic Learning Community.",
};

export default async function CareersPage() {
  await connectToDatabase();
  const postings = await JobPosting.find({ status: "Open" }).sort({ createdAt: -1 }).lean();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Careers</h1>
      {postings.length === 0 ? (
        <p className="text-gray-600">No open positions right now.</p>
      ) : (
        <ul className="space-y-4">
          {postings.map((p) => (
            <li key={p._id.toString()} className="rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-navy">
                <Link href={`/careers/${p._id.toString()}`} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-gray-700">{p.description}</p>
              <Link
                href={`/careers/${p._id.toString()}`}
                className="mt-3 inline-block text-sm text-maroon hover:underline"
              >
                View details & apply →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
