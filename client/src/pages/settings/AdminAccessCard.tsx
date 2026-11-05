import { KeyRound, Lock } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { errorMessage } from "../../api/client";
import { adminApi, metaApi } from "../../api/meta";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { useAsync } from "../../hooks/useAsync";
import { clearAdminKey, readAdminKey, saveAdminKey } from "../../lib/adminKey";

/** Public deployments only: the admin unlocks deleting and app-wide settings for this browser tab. */
export function AdminAccessCard() {
  const load = useCallback(() => metaApi.get(), []);
  const { data } = useAsync(load);
  if (!data?.publicMode) return null;
  return <AdminAccessForm />;
}

function AdminAccessForm() {
  const [unlocked, setUnlocked] = useState(() => !!readAdminKey());
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      await adminApi.check(key.trim());
      saveAdminKey(key.trim());
      setUnlocked(true);
      setKey("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  function lock() {
    clearAdminKey();
    setUnlocked(false);
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Admin access"
        hint="This is a public demo. Deleting, removing demo data and app-wide settings need the admin key."
        action={unlocked ? <Badge tone="success">Unlocked</Badge> : <Badge>Locked</Badge>}
      />
      {unlocked ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">Unlocked for this browser tab. Closing the tab locks it again.</p>
          <Button size="sm" icon={<Lock className="size-3.5" aria-hidden />} onClick={lock}>
            Lock
          </Button>
        </div>
      ) : (
        <form onSubmit={unlock} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <TextField
              id="admin-key"
              label="Admin key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              error={error ?? undefined}
              hint="Kept in this browser tab only, and sent only with your own requests."
            />
          </div>
          <Button type="submit" variant="primary" className="sm:mt-6" loading={checking} disabled={!key.trim()} icon={<KeyRound className="size-4" aria-hidden />}>
            Unlock
          </Button>
        </form>
      )}
    </Card>
  );
}
