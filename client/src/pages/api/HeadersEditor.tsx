import { isSecretName, type HeaderEntry } from "@testmate/shared";
import { Eye, EyeOff, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import { cn } from "../../lib/cn";

const COMMON_HEADERS = ["Accept", "Authorization", "Content-Type", "X-API-Key", "Accept-Language", "Cache-Control", "User-Agent", "If-None-Match"];

const INPUT =
  "h-9 min-w-0 rounded-lg border border-line-strong bg-bg/60 px-2.5 text-sm text-fg placeholder:text-muted/60 focus:border-accent/60 focus:outline-none";

export function HeadersEditor({
  headers,
  onChange,
  errors,
}: {
  headers: HeaderEntry[];
  onChange: (h: HeaderEntry[]) => void;
  errors: Record<string, string>;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const update = (i: number, patch: Partial<HeaderEntry>) => onChange(headers.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  return (
    <div className="space-y-2">
      <datalist id="common-headers">
        {COMMON_HEADERS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>
      {headers.length === 0 && <p className="py-2 text-sm text-muted">No headers. A User-Agent is added automatically.</p>}
      {headers.map((h, i) => {
        const secret = isSecretName(h.key);
        const show = revealed.has(i);
        const keyError = errors[`headers.${i}.key`];
        const valueError = errors[`headers.${i}.value`];
        return (
          <div key={i}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Send header ${h.key || i + 1}`}
                checked={h.enabled}
                onChange={(e) => update(i, { enabled: e.target.checked })}
                className="size-4 shrink-0 accent-[var(--color-accent)]"
              />
              <input
                aria-label="Header name"
                list="common-headers"
                value={h.key}
                placeholder="Header"
                onChange={(e) => update(i, { key: e.target.value })}
                className={cn(INPUT, "w-[38%] shrink-0", keyError && "border-failure/60", !h.enabled && "opacity-50")}
              />
              <div className="relative min-w-0 flex-1">
                <input
                  aria-label={`Value of ${h.key || "header"}`}
                  type={secret && !show ? "password" : "text"}
                  autoComplete="off"
                  value={h.value}
                  placeholder={secret ? "Value or Bearer {{secret:NAME}}" : "Value"}
                  onChange={(e) => update(i, { value: e.target.value })}
                  className={cn(INPUT, "w-full", secret && "pr-8", valueError && "border-failure/60", !h.enabled && "opacity-50")}
                />
                {secret && (
                  <button
                    type="button"
                    aria-label={show ? "Hide value" : "Show value"}
                    onClick={() => setRevealed((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set([...s, i])))}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-muted hover:text-fg"
                  >
                    {show ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                  </button>
                )}
              </div>
              <IconButton
                label={`Remove header ${h.key || i + 1}`}
                icon={<Trash2 className="size-3.5" aria-hidden />}
                className="hover:text-failure"
                onClick={() => onChange(headers.filter((_, j) => j !== i))}
              />
            </div>
            {(keyError || valueError) && <p className="mt-1 ml-6 text-xs text-failure">{keyError ?? valueError}</p>}
            {secret && h.value && !h.value.includes("{{secret:") && (
              <p className="mt-1 ml-6 text-[11px] text-muted">Masked in history. Use {"{{secret:NAME}}"} to keep it out of the browser entirely.</p>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange([...headers, { key: "", value: "", enabled: true }])}>
          Add header
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<KeyRound className="size-3.5" aria-hidden />}
          onClick={() => onChange([...headers, { key: "Authorization", value: "Bearer {{secret:API_TOKEN}}", enabled: true }])}
        >
          Add auth from server secret
        </Button>
      </div>
    </div>
  );
}
