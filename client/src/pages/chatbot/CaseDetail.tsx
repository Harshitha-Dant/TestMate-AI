import type { Execution, TestCase } from "@testmate/shared";
import { Pencil, Play, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { executionsApi } from "../../api/testing";
import { ExecutionResult } from "../../components/execution/ExecutionResult";
import { RunHistory } from "../../components/execution/RunHistory";
import { Badge } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { useAsync } from "../../hooks/useAsync";
import { intentName, langAttr, languageName } from "../../lib/languages";

interface Props {
  testCase: TestCase;
  running: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOverridden: () => void;
}

const MATCH_LABEL = { keywords: "Keywords + relevance", contains: "Contains expected", exact: "Exact match" } as const;

export function CaseDetail({ testCase, running, onRun, onEdit, onDelete, onOverridden }: Props) {
  const load = useCallback(
    () => executionsApi.list(testCase.projectId, { testCaseId: testCase.id, limit: 20 }),
    [testCase.projectId, testCase.id],
  );
  const history = useAsync(load);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const items = history.data?.items ?? [];
  const viewing: Execution | undefined = items.find((e) => e.id === viewingId) ?? items[0];
  const { criteria } = testCase;
  const multilingual = testCase.module === "multilingual";
  // Multilingual tests often rely on language and intent checks alone; only show text criteria when used.
  const showTextCriteria = !multilingual || !!testCase.expected || criteria.requiredKeywords.length > 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{testCase.title}</h2>
          {testCase.isDemo && <Badge tone="warning" className="mt-1">Demo data</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Edit test case" icon={<Pencil className="size-3.5" aria-hidden />} onClick={onEdit} />
          <IconButton label="Delete test case" className="hover:text-failure" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={onDelete} />
          <Button size="sm" variant="primary" loading={running} icon={<Play className="size-3.5" aria-hidden />} onClick={onRun}>
            Run
          </Button>
        </div>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Question</dt>
          <dd className="mt-0.5" lang={langAttr(testCase.inputLanguage)}>
            {testCase.input}
          </dd>
        </div>
        {testCase.expected && (
          <div>
            <dt className="text-xs text-muted">Expected answer</dt>
            <dd className="mt-0.5 text-muted" lang={langAttr(testCase.expectedLanguage)}>
              {testCase.expected}
            </dd>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {multilingual && (
            <>
              <Badge tone="accent">Question: {languageName(testCase.inputLanguage)}</Badge>
              <Badge tone="accent">Reply in: {languageName(testCase.expectedLanguage)}</Badge>
              {testCase.expectedIntent && <Badge tone="accent">Intent: {intentName(testCase.expectedIntent)}</Badge>}
            </>
          )}
          {showTextCriteria && <Badge>{MATCH_LABEL[criteria.matchMode]}</Badge>}
          {showTextCriteria && testCase.expected && <Badge>Relevance ≥ {criteria.minRelevance}%</Badge>}
          {criteria.requiredKeywords.map((k) => (
            <Badge key={`r-${k}`} tone="success">+ {k}</Badge>
          ))}
          {criteria.forbiddenKeywords.map((k) => (
            <Badge key={`f-${k}`} tone="failure">− {k}</Badge>
          ))}
          {criteria.minLength !== null && <Badge>≥ {criteria.minLength} chars</Badge>}
          {criteria.maxLength !== null && <Badge>≤ {criteria.maxLength} chars</Badge>}
        </div>
      </dl>

      <div className="mt-5 border-t border-line pt-5">
        {history.loading ? (
          <LoadingState label="Loading results…" />
        ) : history.error ? (
          <ErrorState message={history.error.message} onRetry={history.reload} />
        ) : !viewing ? (
          <EmptyState title="Not run yet" description="Run this test to see the response and every check." />
        ) : (
          <>
            {viewing.id !== items[0]?.id && (
              <p className="mb-3 text-xs text-warning">Viewing an older run. The latest run is at the top of the history.</p>
            )}
            <ExecutionResult
              execution={viewing}
              onChanged={() => {
                history.refresh();
                onOverridden();
              }}
            />
          </>
        )}
      </div>

      <RunHistory items={items} total={history.data?.total ?? 0} viewingId={viewing?.id} onView={setViewingId} />
    </Card>
  );
}
