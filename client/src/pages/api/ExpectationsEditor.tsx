import { ASSERTION_TYPES, type ApiExpectations, type AssertionType, type FieldAssertion } from "@testmate/shared";
import { suggestFields } from "./draft";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Button, IconButton } from "../../components/ui/Button";
import { cn } from "../../lib/cn";

const INPUT =
  "h-9 min-w-0 rounded-lg border border-line-strong bg-bg/60 px-2.5 text-sm text-fg placeholder:text-muted/60 focus:border-accent/60 focus:outline-none";

export function ExpectationsEditor({
  value,
  onChange,
  lastResponseBody,
  errors,
}: {
  value: ApiExpectations;
  onChange: (v: ApiExpectations) => void;
  lastResponseBody?: string;
  errors: Record<string, string>;
}) {
  const setField = (i: number, patch: Partial<FieldAssertion>) =>
    onChange({ ...value, fields: value.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const suggestions = suggestFields(lastResponseBody, value.fields);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">Expected status</span>
          <input
            type="number"
            min={100}
            max={599}
            value={value.status ?? ""}
            placeholder="Any 2xx"
            onChange={(e) => onChange({ ...value, status: e.target.value ? Number(e.target.value) : null })}
            className={cn(INPUT, "w-full", errors["expectations.status"] && "border-failure/60")}
          />
          {errors["expectations.status"] && <span className="text-xs text-failure">{errors["expectations.status"]}</span>}
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">Max response time (ms)</span>
          <input
            type="number"
            min={1}
            value={value.maxTimeMs ?? ""}
            placeholder="No limit"
            onChange={(e) => onChange({ ...value, maxTimeMs: e.target.value ? Number(e.target.value) : null })}
            className={cn(INPUT, "w-full", errors["expectations.maxTimeMs"] && "border-failure/60")}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">JSON field checks</p>
        {value.fields.length === 0 && <p className="text-sm text-muted">No field checks. Paths look like data.items[0].id</p>}
        {value.fields.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <input
              aria-label="JSON path"
              value={f.path}
              placeholder="data.items[0].id"
              onChange={(e) => setField(i, { path: e.target.value })}
              className={cn(INPUT, "w-full font-mono sm:w-[40%]")}
            />
            <select
              aria-label="Expected type"
              value={f.type}
              onChange={(e) => setField(i, { type: e.target.value as AssertionType })}
              className={cn(INPUT, "w-28 shrink-0")}
            >
              {ASSERTION_TYPES.map((t) => (
                <option key={t} value={t} className="bg-card">
                  {t === "any" ? "exists" : t}
                </option>
              ))}
            </select>
            <input
              aria-label="Expected value (optional)"
              value={f.equals ?? ""}
              placeholder="equals (optional)"
              onChange={(e) => setField(i, { equals: e.target.value === "" ? null : e.target.value })}
              className={cn(INPUT, "min-w-0 flex-1 font-mono")}
            />
            <IconButton
              label={`Remove check ${f.path || i + 1}`}
              className="hover:text-failure"
              icon={<Trash2 className="size-3.5" aria-hidden />}
              onClick={() => onChange({ ...value, fields: value.fields.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            icon={<Plus className="size-3.5" aria-hidden />}
            onClick={() => onChange({ ...value, fields: [...value.fields, { path: "", type: "any", equals: null }] })}
          >
            Add field check
          </Button>
          {suggestions.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Wand2 className="size-3.5" aria-hidden />}
              onClick={() => onChange({ ...value, fields: [...value.fields, ...suggestions] })}
            >
              Suggest {suggestions.length} from last response
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
