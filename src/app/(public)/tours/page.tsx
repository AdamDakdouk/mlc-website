import type { Metadata } from "next";
import BookingForm from "./BookingForm";

export const metadata: Metadata = {
  title: "Book a Tour — MLC",
  description: "Request a campus tour or admission consultation at Modernistic Learning Community.",
};

export default function ToursPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-navy">Book a Tour</h1>
      <p className="mb-8 text-gray-600">
        Interested in visiting MLC? Tell us when works for you and we&apos;ll confirm a time.
      </p>
      <BookingForm />
    </div>
  );
}
