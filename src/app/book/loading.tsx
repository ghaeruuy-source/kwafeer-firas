export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-28">
      <div className="shimmer h-8 w-48 rounded-full" />
      <div className="shimmer mt-3 h-4 w-32 rounded-full" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer h-[72px] rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}
