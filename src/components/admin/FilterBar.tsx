"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

/** Search box + chip filters synced to the URL (server pages read searchParams). */
export function FilterBar({
  placeholder,
  chips,
  chipParam = "status",
  extra,
}: {
  placeholder: string;
  chips?: { value: string; label: string }[];
  chipParam?: string;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  const push = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    startTransition(() => router.replace(`${path}?${sp}`));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) push({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const current = params.get(chipParam) ?? "";
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-12 w-full rounded-xl border border-line bg-coal-2 pr-11 pl-10 text-[15px] placeholder:text-faint focus:border-gold/60 focus:outline-none"
          />
          {pending && <Spinner className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gold" />}
        </div>
        {extra}
      </div>
      {chips && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {[{ value: "", label: "الكل" }, ...chips].map((c) => (
            <button
              key={c.value}
              onClick={() => push({ [chipParam]: c.value || null })}
              className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition", current === c.value ? "border-gold bg-gold text-ink" : "border-line text-mute hover:text-bone")}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
