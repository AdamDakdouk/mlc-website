import type { Metadata } from "next";
import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_MAPS_URL,
  SITE_PHONE,
  SITE_PHONE_HREF,
} from "@/lib/siteContact";

export const metadata: Metadata = {
  title: "Contact — MLC",
  description: "Get in touch with Modernistic Learning Community.",
};

export default function ContactPage() {
  const directionsUrl = SITE_MAPS_URL;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-semibold text-navy">Contact Us</h1>
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-navy">Address</dt>
          <dd className="mt-1 text-gray-700">{SITE_ADDRESS}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Phone</dt>
          <dd className="mt-1">
            <a
              href={SITE_PHONE_HREF}
              className="font-medium text-navy underline underline-offset-2 transition hover:text-maroon"
            >
              {SITE_PHONE}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Email</dt>
          <dd className="mt-1">
            <a
              href={`mailto:${SITE_EMAIL}`}
              className="font-medium text-navy underline underline-offset-2 transition hover:text-maroon"
            >
              {SITE_EMAIL}
            </a>
          </dd>
        </div>
      </dl>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
      >
        Get Directions
      </a>
    </div>
  );
}
