import type { SuiteRunResult, TestSuite } from "@testmate/shared";
import { Play, Rocket } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { suitesApi } from "../../api/testing";
import { IconButton } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { LAB_PATH, MODULE_NAMES } from "../../lib/modules";

interface Props {
  projectId: number;
  suites: TestSuite[] | undefined;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  onRan: () => void;
}

/** Runs any suite in one click and shows the outcome inline. */
export function QuickLaunchCard({ projectId, suites, loading, error, onRetry, onRan }: Props) {
  const [runningId, setRunningId] = useState<number | null>(null);
  const [result, setResult] = useState<{ suite: TestSuite; run?: SuiteRunResult; error?: string } | null>(null);

  async function run(suite: TestSuite) {
    setRunningId(suite.id);
    setResult(null);
    try {
      setResult({ suite, run: await suitesApi.run(projectId, suite.id) });
      onRan();
    } catch (err) {
      setResult({ suite, error: errorMessage(err) });
    } finally {
      setRunningId(null);
    }
  }

  const runnable = suites?.filter((s) => s.itemCount > 0) ?? [];
  return (
    <Card className="flex h-full flex-col p-5">
      <CardHeader title="Quick test launcher" hint="Run a whole suite now." />
      <div className="mt-3 min-h-0 flex-1">
        {loading ? (
          <LoadingState className="py-6" />
        ) : error ? (
          <ErrorState className="py-6" message={error.message} onRetry={onRetry} />
        ) : !runnable.length ? (
          <EmptyState className="py-6" icon={<Rocket className="size-5" aria-hidden />} title="No suites with tests yet" description="Create a suite in any lab to launch it from here." />
        ) : (
          <ul className="space-y-1">
            {runnable.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-fg/[0.03]">
                <div className="min-w-0 flex-1">
                  <Link to={LAB_PATH[s.module]} className="block truncate text-sm hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-[11px] text-muted">
                    {MODULE_NAMES[s.module]} · {s.itemCount} {s.itemCount === 1 ? "test" : "tests"}
                    {s.module === "api" ? " · live HTTP" : ""}
                  </p>
                </div>
                <IconButton
                  label={`Run ${s.name}`}
                  loading={runningId === s.id}
                  disabled={runningId !== null}
                  icon={<Play className="size-3.5" aria-hidden />}
                  onClick={() => run(s)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {result && (
        <p role="status" className="mt-3 rounded-lg border border-line px-3 py-2 text-xs">
          {result.error ? (
            <span className="text-failure">{result.error}</span>
          ) : (
            <>
              <span className="text-fg">{result.suite.name}</span>: <span className="text-success">{result.run!.passed} passed</span>,{" "}
              <span className="text-failure">{result.run!.failed + result.run!.errors} failed</span>, <span className="text-warning">{result.run!.needsReview} review</span>
            </>
          )}
        </p>
      )}
    </Card>
  );
}
