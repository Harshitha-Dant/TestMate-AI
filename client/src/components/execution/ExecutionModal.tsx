import { useCallback } from "react";
import { executionsApi } from "../../api/testing";
import { useAsync } from "../../hooks/useAsync";
import { Modal } from "../ui/Modal";
import { ErrorState, LoadingState } from "../ui/States";
import { ExecutionResult } from "./ExecutionResult";

/** Shows any stored execution (from a regression diff, a bug, history) in a dialog. */
export function ExecutionModal({
  projectId,
  executionId,
  onClose,
  onChanged,
}: {
  projectId: number;
  executionId: number;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const load = useCallback(() => executionsApi.get(projectId, executionId), [projectId, executionId]);
  const { data, loading, error, reload, refresh } = useAsync(load);
  return (
    <Modal open size="lg" onClose={onClose} title={data?.title ?? "Test result"}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        data && (
          <ExecutionResult
            execution={data}
            onChanged={() => {
              refresh();
              onChanged?.();
            }}
          />
        )
      )}
    </Modal>
  );
}
