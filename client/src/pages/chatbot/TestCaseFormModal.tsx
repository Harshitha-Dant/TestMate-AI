import {
  DEFAULT_CRITERIA,
  INTENT_LABELS,
  INTENTS,
  LANGUAGE_LABELS,
  TEST_LANGUAGES,
  type Intent,
  type MatchMode,
  type TestCase,
  type TestCaseInput,
  type TestCriteria,
  type TestLanguage,
  type TestSuite,
} from "@testmate/shared";
import { useState, type FormEvent } from "react";
import { ApiClientError, errorMessage } from "../../api/client";
import { testCasesApi } from "../../api/testing";
import { Button } from "../../components/ui/Button";
import { TextAreaField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { TagInput } from "../../components/ui/TagInput";
import { langAttr } from "../../lib/languages";

const MATCH_MODE_OPTIONS: { value: MatchMode; label: string }[] = [
  { value: "keywords", label: "Keywords + relevance" },
  { value: "contains", label: "Must contain expected text" },
  { value: "exact", label: "Exact match (normalized)" },
];

const LANGUAGE_OPTIONS = TEST_LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }));
const INTENT_OPTIONS = [{ value: "", label: "Any (don't check)" }, ...INTENTS.map((i) => ({ value: i, label: INTENT_LABELS[i] }))];

interface Props {
  projectId: number;
  module: TestCase["module"];
  suites: TestSuite[];
  testCase?: TestCase;
  defaultSuiteId: number | null;
  /** Defaults for new tests, from Settings → Test defaults. */
  defaults?: { inputLanguage: TestLanguage; expectedLanguage: TestLanguage; minRelevance: number };
  onClose: () => void;
  onSaved: (c: TestCase) => void;
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.trunc(Number(v))));

function initialForm(
  module: TestCase["module"],
  testCase: TestCase | undefined,
  suiteId: number | null,
  defaults: Props["defaults"],
): TestCaseInput {
  if (testCase) {
    return {
      suiteId: testCase.suiteId,
      title: testCase.title,
      input: testCase.input,
      expected: testCase.expected,
      criteria: testCase.criteria,
      inputLanguage: testCase.inputLanguage as TestLanguage | null,
      expectedLanguage: testCase.expectedLanguage as TestLanguage | null,
      expectedIntent: testCase.expectedIntent as Intent | null,
    };
  }
  const multilingual = module === "multilingual";
  return {
    suiteId,
    title: "",
    input: "",
    expected: "",
    criteria: { ...DEFAULT_CRITERIA, minRelevance: defaults?.minRelevance ?? DEFAULT_CRITERIA.minRelevance },
    inputLanguage: multilingual ? (defaults?.inputLanguage ?? "te") : null,
    expectedLanguage: multilingual ? (defaults?.expectedLanguage ?? "te") : null,
    expectedIntent: null,
  };
}

export function TestCaseFormModal({ projectId, module, suites, testCase, defaultSuiteId, defaults, onClose, onSaved }: Props) {
  const multilingual = module === "multilingual";
  const [form, setForm] = useState<TestCaseInput>(() => initialForm(module, testCase, defaultSuiteId, defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TestCaseInput>(key: K, value: TestCaseInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setCriteria = <K extends keyof TestCriteria>(key: K, value: TestCriteria[K]) =>
    setForm((f) => ({ ...f, criteria: { ...f.criteria, [key]: value } }));

  /** Keeps the expected reply language in step with the question language until the user picks one. */
  const setInputLanguage = (lang: TestLanguage) =>
    setForm((f) => ({
      ...f,
      inputLanguage: lang,
      expectedLanguage: f.expectedLanguage === f.inputLanguage && lang !== "mixed" ? lang : f.expectedLanguage,
    }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      onSaved(testCase ? await testCasesApi.update(projectId, testCase.id, form) : await testCasesApi.create(projectId, module, form));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") setErrors(err.fieldErrors());
      else setErrors({ _: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const { criteria } = form;
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={testCase ? "Edit test case" : multilingual ? "New multilingual test" : "New test case"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="case-form" loading={saving}>
            {testCase ? "Save changes" : "Create test case"}
          </Button>
        </>
      }
    >
      <form id="case-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <TextField
            label="Title"
            value={form.title}
            maxLength={120}
            error={errors.title}
            placeholder={multilingual ? "e.g. Order status · Telugu" : "e.g. Refund timeline"}
            onChange={(e) => set("title", e.target.value)}
          />
          <SelectField
            label="Suite"
            value={form.suiteId === null ? "" : String(form.suiteId)}
            onChange={(e) => set("suiteId", e.target.value ? Number(e.target.value) : null)}
            options={[{ value: "", label: "No suite" }, ...suites.map((s) => ({ value: String(s.id), label: s.name }))]}
            error={errors.suiteId}
          />
        </div>

        {multilingual && (
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Question language"
              value={form.inputLanguage ?? "te"}
              onChange={(e) => setInputLanguage(e.target.value as TestLanguage)}
              options={LANGUAGE_OPTIONS}
              error={errors.inputLanguage}
            />
            <SelectField
              label="Reply should be in"
              value={form.expectedLanguage ?? ""}
              onChange={(e) => set("expectedLanguage", (e.target.value || null) as TestLanguage | null)}
              options={[{ value: "", label: "Choose…" }, ...LANGUAGE_OPTIONS]}
              error={errors.expectedLanguage}
            />
            <SelectField
              label="Expected intent"
              value={form.expectedIntent ?? ""}
              onChange={(e) => set("expectedIntent", (e.target.value || null) as Intent | null)}
              options={INTENT_OPTIONS}
              error={errors.expectedIntent}
            />
          </div>
        )}

        <TextAreaField
          label="Question sent to the chatbot"
          value={form.input}
          maxLength={4000}
          error={errors.input}
          lang={langAttr(form.inputLanguage)}
          placeholder={multilingual ? "నా ఆర్డర్ ఎక్కడ ఉంది?" : "How long does a refund take?"}
          onChange={(e) => set("input", e.target.value)}
        />
        <TextAreaField
          label={multilingual ? "Expected answer (optional)" : "Expected answer"}
          value={form.expected}
          maxLength={4000}
          error={errors.expected}
          lang={langAttr(form.expectedLanguage)}
          hint={
            multilingual
              ? "Optional. Word overlap only works when it is written in the reply language."
              : "Used for the relevance check (word overlap) and for contains/exact modes."
          }
          placeholder={multilingual ? "" : "Refunds go to your original payment method within 5-7 business days."}
          onChange={(e) => set("expected", e.target.value)}
        />

        <div className="space-y-4 rounded-xl border border-line p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {multilingual ? "Extra text criteria (optional)" : "Criteria (rule-based)"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Match mode"
              value={criteria.matchMode}
              onChange={(e) => setCriteria("matchMode", e.target.value as MatchMode)}
              options={MATCH_MODE_OPTIONS}
            />
            <div className="space-y-1.5">
              <label htmlFor="min-relevance" className="flex justify-between text-xs font-medium text-muted">
                <span>Minimum relevance</span>
                <span className="tabular-nums text-fg">{criteria.minRelevance}%</span>
              </label>
              <input
                id="min-relevance"
                type="range"
                min={0}
                max={100}
                step={5}
                value={criteria.minRelevance}
                onChange={(e) => setCriteria("minRelevance", Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-accent)]"
              />
              <p className="text-xs text-muted/80">Share of the expected answer's key words that must appear.</p>
            </div>
          </div>
          <TagInput
            label="Required keywords"
            value={criteria.requiredKeywords}
            onChange={(v) => setCriteria("requiredKeywords", v)}
            placeholder="Type a keyword and press Enter"
            hint="All must appear. Matching ignores case and punctuation; longer words also match plurals."
            error={errors["criteria.requiredKeywords"]}
          />
          <TagInput
            label="Forbidden terms"
            tone="failure"
            value={criteria.forbiddenKeywords}
            onChange={(v) => setCriteria("forbiddenKeywords", v)}
            placeholder="e.g. guarantee"
            hint="Any match fails the test."
            error={errors["criteria.forbiddenKeywords"]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Min length (characters)" type="number" min={0} value={criteria.minLength ?? ""} placeholder="None" onChange={(e) => setCriteria("minLength", numOrNull(e.target.value))} />
            <TextField
              label="Max length (characters)"
              type="number"
              min={0}
              value={criteria.maxLength ?? ""}
              placeholder="None"
              error={errors["criteria.maxLength"]}
              onChange={(e) => setCriteria("maxLength", numOrNull(e.target.value))}
            />
          </div>
        </div>
        {errors._ && (
          <p role="alert" className="text-sm text-failure">
            {errors._}
          </p>
        )}
      </form>
    </Modal>
  );
}
