import Image from "next/image";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Achievements — MLC",
  description: "Awards, honors, and accomplishments at Modernistic Learning Community.",
};

export default async function AchievementsPage() {
  await connectToDatabase();
  const achievements = await Achievement.find().sort({ date: -1 }).lean();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Achievements</h1>
      {achievements.length === 0 ? (
        <p className="text-gray-600">No achievements to show yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => (
            <article key={a._id.toString()} className="rounded-lg border border-gray-200 p-6">
              {a.photoUrl && (
                <Image
                  src={a.photoUrl}
                  alt={a.title}
                  width={400}
                  height={225}
                  className="mb-4 w-full rounded object-cover"
                />
              )}
              <h2 className="text-lg font-semibold text-navy">{a.title}</h2>
              <p className="mt-1 text-sm text-maroon">
                {a.date.toLocaleDateString(undefined, { timeZone: "UTC" })}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.description}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
