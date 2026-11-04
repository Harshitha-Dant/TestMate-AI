import { MOCK_FAULTS, type MockFault, type MockMode, type MockProviderConfig } from "@testmate/shared";
import { FlaskConical, SlidersHorizontal } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { ApiClientError, errorMessage } from "../../api/client";
import { providerApi } from "../../api/testing";
import { useAsync } from "../../hooks/useAsync";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { SelectField } from "../ui/SelectField";
import { ErrorState, LoadingState } from "../ui/States";

const FAULT_DESCRIPTIONS: Record<MockFault, string> = {
  omit_detail: "Omit detail: drops the last sentence of the answer",
  off_topic: "Off topic: answers a different question",
  forbidden_claim: "Forbidden claim: adds the test's first forbidden term (or a false promise)",
  empty: "Empty: returns nothing",
  wrong_memory: "Wrong memory: recalls a different value than the user gave (Memory Lab)",
  wrong_language: "Wrong language: answers in English instead of the user's language (Multilingual Lab)",
};

const MODE_LABELS: Record<MockMode, string> = {
  "knowledge-base": "Knowledge base (built-in support FAQ)",
  "echo-expected": "Echo expected answer (ideal bot)",
};

/** Shows and edits the project's simulated chatbot. Every result it produces is labeled "Simulated". */
export function MockProviderCard({
  projectId,
  memoryWindowLabel,
  onSaved,
}: {
  projectId: number;
  memoryWindowLabel?: boolean;
  onSaved?: () => void;
}) {
  const load = useCallback(() => providerApi.getMock(projectId), [projectId]);
  const { data, loading, error, reload, refresh } = useAsync(load);
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-accent" aria-hidden />
          <h2 className="text-sm font-medium whitespace-nowrap">Simulated bot</h2>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<SlidersHorizontal className="size-3.5" aria-hidden />}
          disabled={!data}
          onClick={() => setOpen(true)}
        >
          Edit
        </Button>
      </div>
      {loading ? (
        <LoadingState className="py-4" />
      ) : error ? (
        <ErrorState className="py-4" message={error.message} onRetry={reload} />
      ) : (
        data && (
          <dl className="mt-3 space-y-1.5 text-xs">
            <Row label="Mode" value={data.mode === "knowledge-base" ? "Knowledge base" : "Echo expected"} />
            <Row label="Fault rate" value={`${Math.round(data.failureRate * 100)}%`} />
            <Row label="Faults" value={data.faults.length ? `${data.faults.length} enabled` : "none"} />
            <Row label="Seed" value={String(data.seed)} />
            {memoryWindowLabel && (
              <Row label="Memory window" value={`${data.memoryWindow} ${data.memoryWindow === 1 ? "turn" : "turns"}`} />
            )}
          </dl>
        )
      )}
      <p className="mt-3 text-xs text-muted/80">
        No real AI is called. Replies are deterministic, so change the seed or fault rate to simulate a new bot version.
      </p>
      {open && data && (
        <MockProviderModal
          projectId={projectId}
          config={data}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            refresh();
            onSaved?.();
          }}
        />
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function MockProviderModal({
  projectId,
  config,
  onClose,
  onSaved,
}: {
  projectId: number;
  config: MockProviderConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(config);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MockProviderConfig>(key: K, value: MockProviderConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await providerApi.setMock(projectId, draft);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Simulated bot settings"
      description="Configure the mock chatbot used for this project. Faults are injected on purpose so failing tests can be demonstrated."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="mock-form" loading={saving}>
            Save settings
          </Button>
        </>
      }
    >
      <form id="mock-form" onSubmit={submit} className="space-y-4">
        <SelectField
          label="Answer mode"
          value={draft.mode}
          onChange={(e) => set("mode", e.target.value as MockMode)}
          options={Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }))}
          hint={
            draft.mode === "knowledge-base"
              ? "Answers from a small built-in FAQ (orders, refunds, delivery, payments...). Unknown questions get a fallback reply."
              : "Returns each test's expected answer, so only injected faults cause failures. Useful for checking your criteria."
          }
        />
        <div className="space-y-1.5">
          <label htmlFor="fault-rate" className="flex justify-between text-xs font-medium text-muted">
            <span>Fault rate</span>
            <span className="tabular-nums text-fg">{Math.round(draft.failureRate * 100)}%</span>
          </label>
          <input
            id="fault-rate"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(draft.failureRate * 100)}
            onChange={(e) => set("failureRate", Number(e.target.value) / 100)}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-medium text-muted">Faults the bot may inject</legend>
          {MOCK_FAULTS.map((fault) => (
            <label key={fault} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={draft.faults.includes(fault)}
                onChange={(e) =>
                  set("faults", e.target.checked ? [...draft.faults, fault] : draft.faults.filter((f) => f !== fault))
                }
                className="size-4 accent-[var(--color-accent)]"
              />
              {FAULT_DESCRIPTIONS[fault]}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Seed"
            type="number"
            min={0}
            value={draft.seed}
            onChange={(e) => set("seed", Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
            hint="Same seed + same question = same reply."
          />
          <TextField
            label="Memory window (turns)"
            type="number"
            min={0}
            max={50}
            value={draft.memoryWindow}
            onChange={(e) => set("memoryWindow", Math.min(50, Math.max(0, Math.trunc(Number(e.target.value) || 0))))}
            hint="Used by the Memory Lab."
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-failure">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
