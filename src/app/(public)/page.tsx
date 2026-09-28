import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import { Achievement } from "@/models/Achievement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLC — Modernistic Learning Community",
  description: "Modernistic Learning Community (MLC), Bchamoun, Lebanon.",
};

export default async function HomePage() {
  await connectToDatabase();
  const [announcements, achievements] = await Promise.all([
    Announcement.find().sort({ createdAt: -1 }).limit(3).lean(),
    Achievement.find().sort({ date: -1 }).limit(3).lean(),
  ]);

  return (
    <div>
      <section className="flex flex-col items-center bg-cream px-6 py-16 text-center">
        <Image
          src="/images/logo.jpg"
          alt="MLC logo"
          width={96}
          height={96}
          className="rounded-full"
          priority
        />
        <h1 className="mt-6 text-3xl font-semibold text-navy">
          Modernistic Learning Community
        </h1>
        <p className="mt-2 max-w-xl text-gray-600">
          A nurturing, high-quality educational environment in Bchamoun, Lebanon.
        </p>
        <div className="mt-6 flex gap-4">
          <Link
            href="/about"
            className="rounded bg-navy px-5 py-2.5 font-medium text-white transition hover:bg-navy/90"
          >
            About Us
          </Link>
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-navy">Latest Announcements</h2>
            <Link href="/announcements" className="text-sm text-navy hover:underline">
              View All Announcements
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {announcements.map((a) => (
              <article key={a._id.toString()} className="rounded-lg border border-gray-200 p-5">
                {a.imageUrl && (
                  <Image
                    src={a.imageUrl}
                    alt={a.title}
                    width={320}
                    height={180}
                    className="mb-3 w-full rounded object-cover"
                  />
                )}
                <h3 className="font-semibold text-navy">{a.title}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-gray-700">{a.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {achievements.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-navy">Achievements</h2>
            <Link href="/achievements" className="text-sm text-navy hover:underline">
              View All Achievements
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {achievements.map((a) => (
              <article key={a._id.toString()} className="rounded-lg border border-gray-200 p-5">
                {a.photoUrl && (
                  <Image
                    src={a.photoUrl}
                    alt={a.title}
                    width={320}
                    height={180}
                    className="mb-3 w-full rounded object-cover"
                  />
                )}
                <h3 className="font-semibold text-navy">{a.title}</h3>
                <p className="mt-1 text-xs text-maroon">
                  {a.date.toLocaleDateString(undefined, { timeZone: "UTC" })}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-gray-700">{a.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
