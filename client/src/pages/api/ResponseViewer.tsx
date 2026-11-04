import type { ApiErrorKind } from "@testmate/shared";
import { ArrowRightLeft, Clock, HardDrive, Send, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { SendResult } from "../../api/apiStudio";
import { CheckList } from "../../components/execution/CheckList";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/States";
import { SourceBadge, StatusBadge } from "../../components/ui/StatusBadge";
import { Tabs } from "../../components/ui/Tabs";
import { cn } from "../../lib/cn";
import { formatBytes, prettyJson } from "./draft";

const ERROR_TITLES: Record<ApiErrorKind, string> = {
  invalid_url: "Invalid URL",
  blocked: "Blocked by SSRF protection",
  dns: "DNS lookup failed",
  refused: "Connection refused",
  timeout: "Request timed out",
  reset: "Connection reset",
  tls: "TLS / certificate error",
  too_many_redirects: "Too many redirects",
  invalid_request_body: "Invalid request body",
  missing_secret: "Secret not available",
  network: "Network error",
};

function statusTone(status: number) {
  if (status >= 200 && status < 300) return "text-success border-success/30 bg-success/10";
  if (status >= 300 && status < 400) return "text-accent border-accent/30 bg-accent/10";
  if (status >= 400 && status < 500) return "text-warning border-warning/30 bg-warning/10";
  return "text-failure border-failure/30 bg-failure/10";
}

type Tab = "body" | "headers" | "checks";

export function ResponseViewer({ result, sending }: { result: SendResult | null; sending: boolean }) {
  const [tab, setTab] = useState<Tab>("body");

  if (!result) {
    return (
      <Card>
        <EmptyState
          icon={<Send className="size-5" aria-hidden />}
          title={sending ? "Sending…" : "No response yet"}
          description="Send a request to see its status, timing, headers, body and check results. Requests go through the server's SSRF-safe client."
        />
      </Card>
    );
  }

  const { entry, execution } = result;
  const { response, error } = entry;
  const checks = execution.details.checks ?? [];

  if (error) {
    const blocked = error.kind === "blocked";
    return (
      <Card className="p-5" role="alert">
        <div className="flex items-start gap-3">
          <div className={cn("rounded-xl border p-2.5", blocked ? "border-warning/30 bg-warning/10 text-warning" : "border-failure/30 bg-failure/10 text-failure")}>
            {blocked ? <ShieldAlert className="size-5" aria-hidden /> : <TriangleAlert className="size-5" aria-hidden />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{ERROR_TITLES[error.kind]}</h2>
              <StatusBadge status={execution.effectiveStatus} />
            </div>
            <p className="mt-1 text-sm text-muted">{error.message}</p>
            <p className="mt-2 text-xs text-muted/80">No response was received. The attempt is saved in history and Test History.</p>
          </div>
        </div>
      </Card>
    );
  }
  if (!response) return null;

  const pretty = prettyJson(response.body);
  const failed = checks.filter((c) => c.outcome === "fail").length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={cn("rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums", statusTone(response.status))}>
          {response.status} {response.statusText}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Clock className="size-3.5" aria-hidden /> {response.timeMs} ms
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <HardDrive className="size-3.5" aria-hidden /> {formatBytes(response.bodyBytes)}
          {response.truncated && <span className="text-warning">(cut off at size limit)</span>}
        </span>
        {response.redirects.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <ArrowRightLeft className="size-3.5" aria-hidden /> {response.redirects.length} redirect{response.redirects.length > 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <StatusBadge status={execution.effectiveStatus} />
          <SourceBadge source={execution.source} />
        </span>
      </div>
      {response.remoteAddress && <p className="mt-1.5 text-[11px] text-muted">Connected to {response.remoteAddress} after SSRF checks.</p>}

      <Tabs<Tab>
        className="mt-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "body", label: "Body" },
          { id: "headers", label: `Headers (${response.headers.length})` },
          {
            id: "checks",
            label: (
              <>
                Checks{" "}
                <span className={cn("tabular-nums", failed ? "text-failure" : "text-success")}>
                  {checks.length - failed}/{checks.length}
                </span>
              </>
            ),
          },
        ]}
      />

      <div className="pt-4">
        {tab === "body" &&
          (response.body ? (
            <pre className="max-h-[28rem] overflow-auto rounded-xl border border-line bg-bg/60 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-fg">
              {pretty.text}
            </pre>
          ) : (
            <p className="text-sm text-muted">Empty body.</p>
          ))}
        {tab === "headers" && (
          <dl className="divide-y divide-line rounded-xl border border-line text-sm">
            {response.headers.map(([k, v], i) => (
              <div key={`${k}-${i}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 px-3 py-2">
                <dt className="truncate font-mono text-xs text-muted">{k}</dt>
                <dd className="font-mono text-xs break-all">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {tab === "checks" && (
          <div className="space-y-3">
            <p className="text-sm">{execution.explanation}</p>
            <CheckList checks={checks} />
          </div>
        )}
        {response.redirects.length > 0 && tab === "headers" && (
          <div className="mt-3 text-xs text-muted">
            Redirect chain:{" "}
            {response.redirects.map((r) => (
              <span key={r.url} className="mr-2 font-mono">
                {r.status} → {r.url}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted/80">Secret-like headers and JSON values (tokens, cookies, passwords) are masked in what's stored and shown.</p>
    </Card>
  );
}
