import type { ApiStudioSettings } from "@testmate/shared";
import { ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { settingsApi } from "../../api/apiStudio";
import { ApiClientError, errorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { useAsync } from "../../hooks/useAsync";

const PROTECTIONS = [
  "Only http and https; no credentials in URLs",
  "Private, loopback, link-local, CGNAT and cloud-metadata IPs are blocked, including IPv6 and encoded forms",
  "Hostnames are resolved and every address checked; the connection is pinned to the checked IP",
  "Each redirect hop is re-checked (max 5); credentials are dropped on cross-origin redirects",
  "Timeout and response-size cap (decompressed)",
  "Secret-like headers, query values and JSON fields are masked in history",
];

/** Global API Studio safety settings. "Allow localhost" is off by default. */
export function ApiSettingsCard() {
  const load = useCallback(() => settingsApi.getApiStudio(), []);
  const { data, loading, error, reload, refresh } = useAsync(load);
  return (
    <Card className="p-4">
      <CardHeader title="Request safety" hint="Applies to every project." />
      <div className="mt-3">
        {loading ? (
          <LoadingState className="py-6" />
        ) : error ? (
          <ErrorState className="py-6" message={error.message} onRetry={reload} />
        ) : (
          data && <SettingsForm initial={data} onSaved={refresh} />
        )}
      </div>
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted hover:text-fg">
          <ShieldCheck className="size-3.5 text-success" aria-hidden /> SSRF protections in place
        </summary>
        <ul className="mt-2 space-y-1 pl-5 text-[11px] text-muted">
          {PROTECTIONS.map((p) => (
            <li key={p} className="list-disc">
              {p}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function SettingsForm({ initial, onSaved }: { initial: ApiStudioSettings; onSaved: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await settingsApi.setApiStudio(draft);
      setMessage({ ok: true, text: "Saved." });
      onSaved();
    } catch (err) {
      const detail = err instanceof ApiClientError ? Object.values(err.fieldErrors())[0] : undefined;
      setMessage({ ok: false, text: detail ?? errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          aria-label="Allow localhost"
          checked={draft.allowLocalhost}
          onChange={(e) => setDraft({ ...draft, allowLocalhost: e.target.checked })}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          <span className="block text-sm">Allow localhost</span>
          <span className="block text-[11px] text-muted">
            Lets requests reach 127.0.0.1 / ::1 to test a local server. Private networks and metadata IPs stay blocked.
          </span>
        </span>
      </label>
      {draft.allowLocalhost && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
          Localhost access is on. Turn it off when you're done testing local services.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Timeout (s)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={draft.timeoutMs / 1000}
            onChange={(e) => setDraft({ ...draft, timeoutMs: Math.round(Number(e.target.value) * 1000) })}
            className="h-9 w-full rounded-lg border border-line-strong bg-bg/60 px-2.5 text-sm focus:border-accent/60 focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">Max response (KB)</span>
          <input
            type="number"
            min={16}
            max={10240}
            value={draft.maxResponseKb}
            onChange={(e) => setDraft({ ...draft, maxResponseKb: Math.round(Number(e.target.value)) })}
            className="h-9 w-full rounded-lg border border-line-strong bg-bg/60 px-2.5 text-sm focus:border-accent/60 focus:outline-none"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        {message ? <p className={message.ok ? "text-xs text-success" : "text-xs text-failure"}>{message.text}</p> : <span />}
        <Button size="sm" disabled={!dirty} loading={saving} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
