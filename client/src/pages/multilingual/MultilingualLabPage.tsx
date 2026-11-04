import type { ProjectWithStats } from "@testmate/shared";
import { Languages, Sparkles } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../../api/client";
import { multilingualApi } from "../../api/multilingual";
import { RequireProject } from "../../components/RequireProject";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { languageName } from "../../lib/languages";
import { SingleTurnLab, type LabContext } from "../chatbot/SingleTurnLab";
import { LanguageComparisonCard } from "./LanguageComparisonCard";
import { LanguageDetectorCard } from "./LanguageDetectorCard";

export function MultilingualLabPage() {
  return <RequireProject>{(project) => <MultilingualLab key={project.id} project={project} />}</RequireProject>;
}

function MultilingualLab({ project }: { project: ProjectWithStats }) {
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function addSamples(ctx: LabContext) {
    setAdding(true);
    setMessage(null);
    try {
      const { created } = await multilingualApi.addSamples(project.id);
      setMessage({
        tone: "ok",
        text: created.length
          ? `Added ${created.length} sample tests to "Order status in 4 languages". Select the suite and run it.`
          : "All sample tests are already in this project.",
      });
      ctx.onDataChanged();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setAdding(false);
    }
  }

  return (
    <SingleTurnLab
      project={project}
      module="multilingual"
      title="Multilingual Lab"
      description="English, Telugu, Tanglish, Hindi and Hinglish: check the reply's language, intent and content."
      emptyDescription="Write a question in any supported language and choose the language the reply must be in."
      notice={
        <>
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-card/60 px-3 py-2 text-xs text-muted">
            <Languages className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
            <span>
              Language identification is a <span className="text-fg">heuristic</span>: Unicode script ranges for Telugu
              and Devanagari, plus small Tanglish/Hinglish word lists for romanized text. Intents are matched by keyword
              signatures. Nothing is translated or understood semantically. Replies come from the{" "}
              <span className="text-fg">simulated bot</span> unless you switch to a live endpoint.
            </span>
          </p>
          {message && (
            <p
              role="status"
              className={
                message.tone === "ok"
                  ? "mb-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                  : "mb-4 rounded-xl border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-failure"
              }
            >
              {message.text}
            </p>
          )}
        </>
      }
      extraActions={(ctx) => (
        <Button icon={<Sparkles className="size-4" aria-hidden />} loading={adding} onClick={() => addSamples(ctx)}>
          Add sample scenarios
        </Button>
      )}
      renderTop={(ctx) => (
        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <LanguageComparisonCard
            projectId={project.id}
            version={ctx.resultsVersion}
            addingSamples={adding}
            onAddSamples={() => addSamples(ctx)}
          />
          <LanguageDetectorCard />
        </div>
      )}
      renderCaseMeta={(c) => (
        <Badge tone="accent">
          {languageName(c.inputLanguage)} → {languageName(c.expectedLanguage)}
        </Badge>
      )}
    />
  );
}
