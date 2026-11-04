export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="size-24 animate-pulse opacity-80" />
    </div>
  );
}
