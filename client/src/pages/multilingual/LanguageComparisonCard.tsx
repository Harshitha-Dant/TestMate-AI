import { Languages, Sparkles } from "lucide-react";
import { useCallback } from "react";
import { multilingualApi } from "../../api/multilingual";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../lib/cn";
import { languageName } from "../../lib/languages";

interface Props {
  projectId: number;
  /** Changes after runs so the table reloads. */
  version: number;
  onAddSamples: () => void;
  addingSamples: boolean;
}

/** Per-language comparison of each multilingual test's latest run. */
export function LanguageComparisonCard({ projectId, version, onAddSamples, addingSamples }: Props) {
  const load = useCallback(() => {
    void version; // A new version (after runs) means a new loader, which reloads the summary.
    return multilingualApi.summary(projectId);
  }, [projectId, version]);
  const { data, loading, error, reload } = useAsync(load);

  return (
    <Card className="p-5">
      <CardHeader title="Per-language comparison" hint="Latest run of each test, grouped by question language." />
      {loading ? (
        <LoadingState className="py-8" />
      ) : error ? (
        <ErrorState className="py-8" message={error.message} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          className="py-8"
          icon={<Languages className="size-5" aria-hidden />}
          title="No multilingual tests yet"
          description="Add the sample scenarios (Where is my order? in English, Telugu, Tanglish, Hindi and Hinglish) or write your own."
          action={
            <Button size="sm" variant="primary" loading={addingSamples} icon={<Sparkles className="size-3.5" aria-hidden />} onClick={onAddSamples}>
              Add sample scenarios
            </Button>
          }
        />
      ) : (
        <div className="mt-4 -mx-1 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                <th className="px-1 pb-2 font-medium">Language</th>
                <th className="px-1 pb-2 font-medium">Pass rate</th>
                <th className="px-1 pb-2 text-right font-medium">Pass / Fail / Review</th>
                <th className="px-1 pb-2 text-right font-medium">Wrong language</th>
                <th className="px-1 pb-2 text-right font-medium">Avg score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((row) => (
                <tr key={row.language}>
                  <td className="px-1 py-2.5">
                    <span className="font-medium">{languageName(row.language)}</span>
                    <span className="ml-1.5 text-xs text-muted">
                      {row.run}/{row.cases} run
                    </span>
                  </td>
                  <td className="w-[30%] px-1 py-2.5">
                    {row.passRate === null ? (
                      <span className="text-xs text-muted">Not run</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/5">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              row.passRate >= 80 ? "bg-success" : row.passRate >= 50 ? "bg-warning" : "bg-failure",
                            )}
                            style={{ width: `${row.passRate}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs tabular-nums">{row.passRate}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-2.5 text-right text-xs tabular-nums">
                    <span className="text-success">{row.passed}</span> / <span className="text-failure">{row.failed + row.errors}</span> /{" "}
                    <span className="text-warning">{row.needsReview}</span>
                  </td>
                  <td className={cn("px-1 py-2.5 text-right tabular-nums", row.wrongLanguage > 0 ? "text-failure" : "text-muted")}>
                    {row.wrongLanguage}
                  </td>
                  <td className="px-1 py-2.5 text-right tabular-nums">{row.avgScore ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
