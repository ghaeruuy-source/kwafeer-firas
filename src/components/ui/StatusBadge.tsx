import { cn } from "@/lib/cn";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/status";
import type { BookingStatus } from "@/lib/types";

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
