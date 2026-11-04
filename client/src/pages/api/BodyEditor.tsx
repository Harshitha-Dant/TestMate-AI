import { BODY_TYPES, type BodyType, type HttpMethod } from "@testmate/shared";
import { Braces, CircleCheck, CircleX } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";

const LABELS: Record<BodyType, string> = { none: "None", json: "JSON", text: "Text" };

function jsonStatus(body: string): { ok: boolean; message: string } | null {
  if (!body.trim()) return null;
  try {
    JSON.parse(body);
    return { ok: true, message: "Valid JSON" };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export function BodyEditor({
  method,
  bodyType,
  body,
  onChange,
  onSend,
}: {
  method: HttpMethod;
  bodyType: BodyType;
  body: string;
  onChange: (patch: { bodyType?: BodyType; body?: string }) => void;
  onSend: () => void;
}) {
  const status = bodyType === "json" ? jsonStatus(body) : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Body type" className="flex rounded-lg border border-line-strong p-0.5">
          {BODY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={bodyType === t}
              onClick={() => onChange({ bodyType: t })}
              className={cn("rounded-md px-3 py-1 text-xs transition-colors", bodyType === t ? "bg-card-2 text-fg" : "text-muted hover:text-fg")}
            >
              {LABELS[t]}
            </button>
          ))}
        </div>
        {bodyType === "json" && status?.ok && (
          <Button size="sm" variant="ghost" icon={<Braces className="size-3.5" aria-hidden />} onClick={() => onChange({ body: JSON.stringify(JSON.parse(body), null, 2) })}>
            Format
          </Button>
        )}
      </div>
      {bodyType === "none" ? (
        <p className="py-2 text-sm text-muted">No body is sent.</p>
      ) : (
        <>
          {method === "GET" && <p className="text-xs text-warning">GET requests are sent without a body.</p>}
          <textarea
            aria-label="Request body"
            value={body}
            spellCheck={false}
            onChange={(e) => onChange({ body: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={bodyType === "json" ? '{\n  "title": "Where is my order?"\n}' : "Plain text body"}
            className="min-h-40 w-full rounded-xl border border-line-strong bg-bg/60 px-3 py-2 font-mono text-[13px] leading-relaxed text-fg placeholder:text-muted/50 focus:border-accent/60 focus:outline-none"
          />
          {status && (
            <p className={cn("flex items-center gap-1.5 text-xs", status.ok ? "text-success" : "text-failure")}>
              {status.ok ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleX className="size-3.5" aria-hidden />}
              {status.message}
            </p>
          )}
          <p className="text-[11px] text-muted">
            Values under secret-like keys (password, token, api_key…) are masked in history. {"{{secret:NAME}}"} works here too.
          </p>
        </>
      )}
    </div>
  );
}
