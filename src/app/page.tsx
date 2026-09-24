import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-cream px-6 text-center">
      <Image
        src="/images/logo.jpg"
        alt="MLC logo"
        width={96}
        height={96}
        className="rounded-full"
        priority
      />
      <h1 className="mt-6 text-2xl font-semibold text-navy">
        Modernistic Learning Community
      </h1>
      <p className="mt-2 text-maroon">Site coming soon.</p>
    </div>
  );
}
