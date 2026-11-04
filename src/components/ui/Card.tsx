import { cn } from "@/lib/cn";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line-soft bg-coal/80 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
      <div>
        <h2 className="font-display text-lg text-bone">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-mute">{description}</p>}
      </div>
      {action}
    </div>
  );
}
