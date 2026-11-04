import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const CONTROL =
  "w-full rounded-xl border bg-bg/60 px-3 text-sm text-fg placeholder:text-muted/60 transition-colors " +
  "focus:border-accent/60 focus:outline-none";

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  id: string;
  children: React.ReactNode;
}

function FieldShell({ label, error, hint, id, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-xs text-failure">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-xs text-muted/80">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(CONTROL, "h-10", error ? "border-failure/60" : "border-line-strong", className)}
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string };

export function TextAreaField({ label, error, hint, className, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <textarea
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(CONTROL, "min-h-20 py-2", error ? "border-failure/60" : "border-line-strong", className)}
        {...rest}
      />
    </FieldShell>
  );
}
