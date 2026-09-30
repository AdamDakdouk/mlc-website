import type { Metadata } from "next";
import MeetingRequestClient from "./MeetingRequestClient";

export const metadata: Metadata = {
  title: "Request a Meeting — MLC",
  description: "Request a meeting with Modernistic Learning Community.",
};

export default function MeetingRequestsPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-navy">Request a Meeting</h1>
      <p className="mb-8 text-gray-600">
        Send us your details and we&apos;ll contact you to arrange a time.
      </p>
      <MeetingRequestClient />
    </div>
  );
}
