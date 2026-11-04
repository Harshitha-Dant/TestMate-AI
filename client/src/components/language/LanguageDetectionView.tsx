import type { LanguageDetection, LanguageFamily } from "@testmate/shared";
import { cn } from "../../lib/cn";
import { languageName } from "../../lib/languages";
import { Badge } from "../ui/Badge";

const FAMILY: Record<LanguageFamily, { label: string; className: string }> = {
  te: { label: "Telugu", className: "bg-accent" },
  hi: { label: "Hindi", className: "bg-warning" },
  en: { label: "English", className: "bg-success" },
};

const METHOD: Record<LanguageDetection["method"], string> = {
  script: "by script",
  lexicon: "by word list",
  none: "weak evidence",
};

/** Stacked bar of language families in a text, with a legend. */
export function CompositionBar({ composition, className }: { composition: LanguageDetection["composition"]; className?: string }) {
  const parts = (Object.keys(FAMILY) as LanguageFamily[]).filter((f) => composition[f] > 0);
  return (
    <div className={className}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-fg/5" role="img" aria-label={parts.map((f) => `${FAMILY[f].label} ${composition[f]}%`).join(", ")}>
        {parts.map((f) => (
          <span key={f} className={cn("h-full", FAMILY[f].className)} style={{ width: `${composition[f]}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {parts.map((f) => (
          <span key={f} className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", FAMILY[f].className)} aria-hidden />
            {FAMILY[f].label} {composition[f]}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Compact summary of one detection: language, how it was decided, confidence and evidence. */
export function LanguageDetectionView({ detection, label }: { detection: LanguageDetection; label?: string }) {
  const name =
    detection.language === "mixed" && detection.primary
      ? `Mixed (mostly ${languageName(detection.primary)})`
      : languageName(detection.language);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {label && <span className="text-xs text-muted">{label}</span>}
        <span className="text-sm font-medium">{name}</span>
        <Badge>{METHOD[detection.method]}</Badge>
        <Badge tone={detection.confidence === "high" ? "success" : detection.confidence === "medium" ? "warning" : "neutral"}>
          {detection.confidence} confidence
        </Badge>
      </div>
      <CompositionBar composition={detection.composition} />
      {detection.evidence.length > 0 && (
        <p className="text-[11px] text-muted">
          Matched romanized words: <span className="text-fg">{detection.evidence.join(", ")}</span>
        </p>
      )}
    </div>
  );
}
