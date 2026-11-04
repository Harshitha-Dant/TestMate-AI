import type { ChatbotTarget, HttpChatbotConfig } from "@testmate/shared";
import { FlaskConical, Globe, SlidersHorizontal } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { ApiClientError, errorMessage } from "../../api/client";
import { providerApi } from "../../api/testing";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../lib/cn";
import { HeadersEditor } from "../../pages/api/HeadersEditor";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { ErrorState, LoadingState } from "../ui/States";
import { MockProviderCard } from "./MockProviderCard";

const EMPTY_HTTP: HttpChatbotConfig = { url: "", replyPath: "reply", headers: [], sendHistory: true };

/**
 * Chooses the chatbot under test for the project: the built-in simulated bot (results labeled Simulated)
 * or a live HTTP endpoint (results labeled Live, sent through the SSRF-safe client).
 */
export function ChatbotTargetPanel({
  projectId,
  memoryWindowLabel,
  onChanged,
}: {
  projectId: number;
  memoryWindowLabel?: boolean;
  onChanged?: () => void;
}) {
  const load = useCallback(() => providerApi.getTarget(projectId), [projectId]);
  const { data, loading, error, reload, refresh } = useAsync(load);
  const [editing, setEditing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string>();

  async function switchToSimulated() {
    if (!data) return;
    setSwitching(true);
    setSwitchError(undefined);
    try {
      await providerApi.setTarget(projectId, { kind: "mock", http: data.http });
      refresh();
      onChanged?.();
    } catch (err) {
      setSwitchError(errorMessage(err));
    } finally {
      setSwitching(false);
    }
  }

  if (loading) return <Card className="p-4"><LoadingState className="py-4" /></Card>;
  if (error || !data) return <Card className="p-4"><ErrorState className="py-4" message={error?.message ?? "Unavailable"} onRetry={reload} /></Card>;

  const live = data.kind === "http" && data.http;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Chatbot under test</p>
        <div role="radiogroup" aria-label="Chatbot under test" className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-line-strong p-1">
          <button
            type="button"
            role="radio"
            aria-checked={!live}
            disabled={switching}
            onClick={() => live && void switchToSimulated()}
            className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap transition-colors", !live ? "bg-card-2 text-fg" : "text-muted hover:text-fg")}
          >
            <FlaskConical className="size-3.5" aria-hidden /> Simulated
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!!live}
            onClick={() => setEditing(true)}
            aria-label="Live endpoint"
            title="Test your own HTTP chatbot"
            className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap transition-colors", live ? "bg-card-2 text-fg" : "text-muted hover:text-fg")}
          >
            <Globe className="size-3.5" aria-hidden /> Live
          </button>
        </div>
        {switchError && <p className="mt-2 text-xs text-failure">{switchError}</p>}
        {live && data.http && (
          <div className="mt-3 space-y-1.5 text-xs">
            <p className="truncate font-mono text-fg" title={data.http.url}>
              POST {data.http.url}
            </p>
            <p className="text-muted">
              Reply field: <span className="text-fg">{data.http.replyPath || "(whole body)"}</span> · history{" "}
              {data.http.sendHistory ? "sent" : "not sent"}
            </p>
            <div className="flex justify-between gap-2 pt-1">
              <span className="text-muted">Results are labeled Live.</span>
              <Button size="sm" variant="ghost" icon={<SlidersHorizontal className="size-3.5" aria-hidden />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          </div>
        )}
      </Card>
      {!live && <MockProviderCard projectId={projectId} memoryWindowLabel={memoryWindowLabel} onSaved={onChanged} />}
      {editing && (
        <LiveEndpointModal
          projectId={projectId}
          initial={data.http ?? EMPTY_HTTP}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function LiveEndpointModal({
  projectId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: number;
  initial: HttpChatbotConfig;
  onClose: () => void;
  onSaved: (t: ChatbotTarget) => void;
}) {
  const [form, setForm] = useState<HttpChatbotConfig>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      onSaved(await providerApi.setTarget(projectId, { kind: "http", http: form }));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        const fe = err.fieldErrors();
        setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.replace(/^http\./, ""), v])));
      } else setErrors({ _: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Test a live chatbot"
      description="TestMate sends each question to your endpoint from the server, through the same SSRF protection as the API Studio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="live-bot-form" loading={saving}>
            Use this endpoint
          </Button>
        </>
      }
    >
      <form id="live-bot-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Endpoint URL"
          value={form.url}
          placeholder="https://my-bot.example.com/chat"
          error={errors.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <TextField
          label="Reply field in the JSON response"
          value={form.replyPath}
          placeholder="reply"
          hint='Dot path such as reply or data.choices[0].text. Leave empty to use the whole response body as text.'
          onChange={(e) => setForm({ ...form, replyPath: e.target.value })}
        />
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.sendHistory}
            onChange={(e) => setForm({ ...form, sendHistory: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
          />
          <span>
            Send the conversation history
            <span className="block text-[11px] text-muted">Needed for Memory Lab tests, unless your bot keeps its own session.</span>
          </span>
        </label>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Headers</p>
          <HeadersEditor headers={form.headers} onChange={(headers) => setForm({ ...form, headers })} errors={errors} />
        </div>
        <div className="rounded-xl border border-line bg-card-2/50 p-3 text-xs text-muted">
          <p className="font-medium text-fg">Request sent for every question</p>
          <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap">{`POST ${form.url || "<endpoint>"}
{ "message": "<latest question>", "messages": [{ "role": "user" | "assistant", "content": "..." }] }`}</pre>
          <p className="mt-2">
            Credentials must be <code className="text-fg">{"{{secret:NAME}}"}</code> placeholders read from <code className="text-fg">TESTMATE_SECRET_NAME</code> in
            the server's .env. Localhost endpoints need "Allow localhost" (API Studio or Settings).
          </p>
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
