import {
  TURN_KINDS,
  type ConversationScript,
  type ConversationScriptInput,
  type TestSuite,
  type TurnExpectation,
  type TurnKind,
} from "@testmate/shared";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiClientError, errorMessage } from "../../api/client";
import { conversationsApi } from "../../api/testing";
import { Button, IconButton } from "../../components/ui/Button";
import { TextAreaField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { TagInput } from "../../components/ui/TagInput";
import { TURN_KIND_HINTS, TURN_KIND_LABELS } from "./turnKinds";

type TurnDraft = ConversationScriptInput["turns"][number] & { key: number };

const blankExpectation = (kind: TurnKind = "statement"): TurnExpectation => ({
  kind,
  mustInclude: [],
  mustIncludeAny: [],
  mustNotInclude: [],
});

let nextKey = 1;
const draft = (userMessage = "", expectation = blankExpectation()): TurnDraft => ({ key: nextKey++, userMessage, expectation });

const EXAMPLE: TurnDraft[] = [
  draft("My name is Ravi."),
  draft("I live in Hyderabad."),
  draft("What is my name?", { ...blankExpectation("recall"), mustInclude: ["Ravi"] }),
];

interface Props {
  projectId: number;
  suites: TestSuite[];
  script?: ConversationScript;
  defaultSuiteId: number | null;
  onClose: () => void;
  onSaved: (s: ConversationScript) => void;
}

export function ScriptFormModal({ projectId, suites, script, defaultSuiteId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(script?.title ?? "");
  const [description, setDescription] = useState(script?.description ?? "");
  const [suiteId, setSuiteId] = useState<number | null>(script ? script.suiteId : defaultSuiteId);
  const [turns, setTurns] = useState<TurnDraft[]>(
    script ? script.turns.map((t) => draft(t.userMessage, t.expectation)) : [draft(), draft()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const updateTurn = (key: number, patch: Partial<TurnDraft>) =>
    setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const updateExp = (key: number, patch: Partial<TurnExpectation>) =>
    setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, expectation: { ...t.expectation, ...patch } } : t)));
  const move = (index: number, delta: number) =>
    setTurns((ts) => {
      const next = [...ts];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item!);
      return next;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const input: ConversationScriptInput = {
      suiteId,
      title: title.trim(),
      description: description.trim(),
      turns: turns.map(({ userMessage, expectation }) => ({ userMessage: userMessage.trim(), expectation })),
    };
    try {
      onSaved(script ? await conversationsApi.update(projectId, script.id, input) : await conversationsApi.create(projectId, input));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") setErrors(err.fieldErrors());
      else setErrors({ _: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const turnError = (i: number, field: string) => errors[`turns.${i}.${field}`];

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={script ? "Edit conversation script" : "New conversation script"}
      description="Each turn is sent in order with the full history. Mark which turns test memory."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="script-form" loading={saving}>
            {script ? "Save changes" : "Create script"}
          </Button>
        </>
      }
    >
      <form id="script-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <TextField label="Title" value={title} maxLength={120} error={errors.title} placeholder="e.g. Name recall" onChange={(e) => setTitle(e.target.value)} />
          <SelectField
            label="Suite"
            value={suiteId === null ? "" : String(suiteId)}
            onChange={(e) => setSuiteId(e.target.value ? Number(e.target.value) : null)}
            options={[{ value: "", label: "No suite" }, ...suites.map((s) => ({ value: String(s.id), label: s.name }))]}
          />
        </div>
        <TextField label="Description" hint="Optional" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />

        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Turns ({turns.length})</p>
          {!script && (
            <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5" aria-hidden />} onClick={() => setTurns(EXAMPLE.map((t) => draft(t.userMessage, t.expectation)))}>
              Use name-recall example
            </Button>
          )}
        </div>
        {errors.turns && <p className="text-sm text-failure">{errors.turns}</p>}

        <ol className="space-y-3">
          {turns.map((t, i) => {
            const kind = t.expectation.kind;
            return (
              <li key={t.key} className="space-y-3 rounded-xl border border-line bg-card-2/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted">Turn {i + 1}</span>
                  <div className="ml-auto flex">
                    <IconButton label="Move up" disabled={i === 0} icon={<ArrowUp className="size-3.5" aria-hidden />} onClick={() => move(i, -1)} />
                    <IconButton label="Move down" disabled={i === turns.length - 1} icon={<ArrowDown className="size-3.5" aria-hidden />} onClick={() => move(i, 1)} />
                    <IconButton
                      label={`Remove turn ${i + 1}`}
                      className="hover:text-failure"
                      disabled={turns.length <= 2}
                      icon={<Trash2 className="size-3.5" aria-hidden />}
                      onClick={() => setTurns((ts) => ts.filter((x) => x.key !== t.key))}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <TextAreaField
                    label="User message"
                    className="min-h-14"
                    value={t.userMessage}
                    maxLength={2000}
                    error={turnError(i, "userMessage")}
                    onChange={(e) => updateTurn(t.key, { userMessage: e.target.value })}
                  />
                  <SelectField
                    label="Turn type"
                    value={kind}
                    hint={TURN_KIND_HINTS[kind]}
                    onChange={(e) => updateExp(t.key, { kind: e.target.value as TurnKind })}
                    options={TURN_KINDS.map((k) => ({ value: k, label: TURN_KIND_LABELS[k] }))}
                  />
                </div>
                {kind === "follow_up" ? (
                  <TagInput
                    label="Reply should mention at least one of"
                    value={t.expectation.mustIncludeAny}
                    onChange={(v) => updateExp(t.key, { mustIncludeAny: v })}
                    placeholder="e.g. 5-7 business days"
                    error={turnError(i, "expectation.mustIncludeAny")}
                  />
                ) : (
                  <TagInput
                    label={kind === "recall" ? "Must recall" : "Reply should include (optional)"}
                    value={t.expectation.mustInclude}
                    onChange={(v) => updateExp(t.key, { mustInclude: v })}
                    placeholder="e.g. Ravi"
                    error={turnError(i, "expectation.mustInclude")}
                  />
                )}
                <TagInput
                  label="Must not mention (wrong or outdated facts)"
                  tone="failure"
                  value={t.expectation.mustNotInclude}
                  onChange={(v) => updateExp(t.key, { mustNotInclude: v })}
                  placeholder="e.g. Hyderabad"
                />
              </li>
            );
          })}
        </ol>
        <Button
          size="sm"
          icon={<Plus className="size-3.5" aria-hidden />}
          disabled={turns.length >= 30}
          onClick={() => setTurns((ts) => [...ts, draft()])}
        >
          Add turn
        </Button>
        {errors._ && (
          <p role="alert" className="text-sm text-failure">
            {errors._}
          </p>
        )}
      </form>
    </Modal>
  );
}
