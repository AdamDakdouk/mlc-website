export default function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">{title}</h1>
      <p className="mt-2 text-gray-600">Coming soon.</p>
    </div>
  );
}
