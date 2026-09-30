import Link from "next/link";

export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-navy transition hover:text-maroon"
    >
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
