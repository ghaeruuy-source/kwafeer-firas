import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-line bg-coal-2 px-4 text-[15px] text-bone placeholder:text-faint transition " +
  "focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:opacity-60 aria-[invalid=true]:border-rose-500/60";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-bone/90">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string | null };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, className, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <input ref={ref} id={inputId} aria-invalid={Boolean(error)} className={cn(control, "h-12", className)} {...props} />
    </Field>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; error?: string | null };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <textarea ref={ref} id={inputId} aria-invalid={Boolean(error)} className={cn(control, "min-h-24 py-3", className)} {...props} />
    </Field>
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string; error?: string | null };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <select ref={ref} id={inputId} aria-invalid={Boolean(error)} className={cn(control, "h-12 appearance-none", className)} {...props}>
        {children}
      </select>
    </Field>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
  name,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  name?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line-soft bg-coal-2/60 px-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-faint">{description}</span>}
      </span>
      <input type="checkbox" name={name} className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold/50 after:absolute after:top-0.5 after:right-0.5 after:size-5 after:rounded-full after:bg-bone after:transition peer-checked:after:-translate-x-5 peer-checked:after:bg-ink"
      />
    </label>
  );
}
