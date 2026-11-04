import { FlaskConical } from "lucide-react";
import { RequireProject } from "../../components/RequireProject";
import { SingleTurnLab } from "./SingleTurnLab";

export function ChatbotLabPage() {
  return (
    <RequireProject>
      {(project) => (
        <SingleTurnLab
          key={project.id}
          project={project}
          module="chatbot"
          title="Chatbot Test Lab"
          description="Single-turn tests: send a question, then judge the reply with transparent rules."
          notice={
            <p className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-card/60 px-3 py-2 text-xs text-muted">
              <FlaskConical className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
              <span>
                Replies come from the <span className="text-fg">simulated bot</span> (labeled Simulated) unless you switch
                to a <span className="text-fg">live endpoint</span> (labeled Live). Evaluation is <span className="text-fg">rule-based</span>: normalized text matching,
                keyword coverage, forbidden terms, word overlap and length. It doesn't understand meaning or paraphrase.
              </span>
            </p>
          }
        />
      )}
    </RequireProject>
  );
}
