import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  tone?: "neutral" | "failure";
}

/** Keyword chips: Enter or comma adds, Backspace on an empty input removes the last chip. */
export function TagInput({ label, value, onChange, placeholder, hint, error, tone = "neutral" }: TagInputProps) {
  const id = useId();
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim();
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border bg-bg/60 px-2 py-1.5 focus-within:border-accent/60",
          error ? "border-failure/60" : "border-line-strong",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs",
              tone === "failure" ? "bg-failure/10 text-failure" : "bg-card-2 text-fg",
            )}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="opacity-60 hover:opacity-100"
              onClick={() => onChange(value.filter((v) => v !== tag))}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm text-fg placeholder:text-muted/60 focus:outline-none"
        />
      </div>
      {error ? <p className="text-xs text-failure">{error}</p> : hint && <p className="text-xs text-muted/80">{hint}</p>}
    </div>
  );
}
