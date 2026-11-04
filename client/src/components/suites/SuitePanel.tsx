import type { TestSuite } from "@testmate/shared";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { IconButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorState, LoadingState } from "../ui/States";
import { cn } from "../../lib/cn";

export type SuiteFilter = "all" | "none" | number;

interface Props {
  suites: TestSuite[] | undefined;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  filter: SuiteFilter;
  onFilter: (f: SuiteFilter) => void;
  onCreate: () => void;
  onEdit: (s: TestSuite) => void;
  onDelete: (s: TestSuite) => void;
  /** Plural noun for the items, e.g. "tests" or "scripts". */
  itemNoun?: string;
}

export function SuitePanel({
  suites,
  loading,
  error,
  onRetry,
  filter,
  onFilter,
  onCreate,
  onEdit,
  onDelete,
  itemNoun = "tests",
}: Props) {
  return (
    <Card className="p-2">
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <h2 className="text-sm font-medium">Suites</h2>
        <IconButton label="New suite" icon={<Plus className="size-4" aria-hidden />} onClick={onCreate} />
      </div>
      {loading ? (
        <LoadingState className="py-6" />
      ) : error ? (
        <ErrorState className="py-6" message={error.message} onRetry={onRetry} />
      ) : (
        <ul className="space-y-0.5">
          <FilterItem label={`All ${itemNoun}`} active={filter === "all"} onClick={() => onFilter("all")} />
          {suites?.map((s) => (
            <li key={s.id} className="group relative">
              <button
                type="button"
                onClick={() => onFilter(s.id)}
                aria-current={filter === s.id}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 pr-16 text-left text-sm transition-colors",
                  filter === s.id ? "bg-card-2 text-fg" : "text-muted hover:bg-fg/[0.03] hover:text-fg",
                )}
              >
                <span className="truncate">{s.name}</span>
              </button>
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs tabular-nums text-muted group-hover:hidden group-focus-within:hidden">
                {s.itemCount}
              </span>
              <div className="absolute top-1/2 right-1 hidden -translate-y-1/2 group-hover:flex group-focus-within:flex">
                <IconButton label={`Edit ${s.name}`} icon={<Pencil className="size-3" aria-hidden />} onClick={() => onEdit(s)} />
                <IconButton
                  label={`Delete ${s.name}`}
                  className="hover:text-failure"
                  icon={<Trash2 className="size-3" aria-hidden />}
                  onClick={() => onDelete(s)}
                />
              </div>
            </li>
          ))}
          <FilterItem label="Not in a suite" active={filter === "none"} onClick={() => onFilter("none")} />
        </ul>
      )}
    </Card>
  );
}

function FilterItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active}
        className={cn(
          "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
          active ? "bg-card-2 text-fg" : "text-muted hover:bg-fg/[0.03] hover:text-fg",
        )}
      >
        {label}
      </button>
    </li>
  );
}
