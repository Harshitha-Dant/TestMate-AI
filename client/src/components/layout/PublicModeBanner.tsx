import { Globe } from "lucide-react";
import { useCallback } from "react";
import { metaApi } from "../../api/meta";
import { useAsync } from "../../hooks/useAsync";

/** Shown only on a public deployment: data is shared and visible to every visitor. */
export function PublicModeBanner() {
  const load = useCallback(() => metaApi.get(), []);
  const { data } = useAsync(load);
  if (!data?.publicMode) return null;
  return (
    <div role="note" className="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-fg">
      <Globe className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        <span className="font-medium">Public demo.</span> Projects and results are shared with every visitor and kept online.
        Don&apos;t enter real API tokens, passwords or personal data. Deleting needs the admin key.
      </p>
    </div>
  );
}
