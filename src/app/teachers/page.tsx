import Image from "next/image";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teachers — MLC",
  description: "Meet the teaching staff of Modernistic Learning Community.",
};

export default async function TeachersPage() {
  await connectToDatabase();
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Our Teachers</h1>
      {teachers.length === 0 ? (
        <p className="text-gray-600">No teachers to show yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <article key={t._id.toString()} className="rounded-lg border border-gray-200 p-6">
              <div className="mb-4 flex justify-center">
                {t.photoUrl ? (
                  <Image
                    src={t.photoUrl}
                    alt={t.name}
                    width={96}
                    height={96}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-navy/10 text-2xl text-navy">
                    {t.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <h2 className="text-center text-lg font-semibold text-navy">{t.name}</h2>
              <p className="mt-1 text-center text-sm text-maroon">{t.subjects.join(", ")}</p>
              {t.qualifications && <p className="mt-3 text-sm text-gray-700">{t.qualifications}</p>}
              {t.experience && <p className="mt-2 text-sm text-gray-600">{t.experience}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
