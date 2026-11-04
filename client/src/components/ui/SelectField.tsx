import { ChevronDown } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
};

export function SelectField({ label, hint, error, options, className, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={!!error}
          className={cn(
            "h-10 w-full appearance-none rounded-xl border bg-bg/60 pr-9 pl-3 text-sm text-fg transition-colors",
            "focus:border-accent/60 focus:outline-none",
            error ? "border-failure/60" : "border-line-strong",
            className,
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-card">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {error ? <p className="text-xs text-failure">{error}</p> : hint && <p className="text-xs text-muted/80">{hint}</p>}
    </div>
  );
}
