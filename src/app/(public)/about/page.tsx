import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — MLC",
  description: "Learn about Modernistic Learning Community's mission and history.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-semibold text-navy">About MLC</h1>
      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold text-navy">Our Mission</h2>
        <p className="text-gray-700">
          Modernistic Learning Community is committed to providing a nurturing,
          high-quality educational environment where every student is empowered
          to reach their full potential. We combine strong academics with a
          supportive, community-focused approach to learning.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold text-navy">Our Story</h2>
        <p className="text-gray-700">
          Located in Bchamoun, Lebanon, MLC serves students across all grade
          levels with a dedicated team of teachers and staff focused on
          academic excellence, character development, and preparing students
          for lifelong success.
        </p>
      </section>
    </div>
  );
}
