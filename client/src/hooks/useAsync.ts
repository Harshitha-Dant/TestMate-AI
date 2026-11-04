import { useCallback, useEffect, useState } from "react";

interface Settled<T> {
  fn: () => Promise<T>;
  nonce: number;
  data?: T;
  error?: Error;
}

/**
 * Runs `fn` (memoize it with useCallback) and tracks loading/data/error.
 * `reload()` shows the loading state again; `refresh()` re-fetches quietly and keeps current data on screen.
 */
export function useAsync<T>(fn: () => Promise<T>) {
  const [nonce, setNonce] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (data) => !cancelled && setSettled({ fn, nonce, data }),
      (err: unknown) =>
        !cancelled && setSettled({ fn, nonce, error: err instanceof Error ? err : new Error(String(err)) }),
    );
    return () => {
      cancelled = true;
    };
  }, [fn, nonce]);

  const reload = useCallback(() => {
    setQuiet(false);
    setNonce((n) => n + 1);
  }, []);
  const refresh = useCallback(() => {
    setQuiet(true);
    setNonce((n) => n + 1);
  }, []);

  const current = settled?.fn === fn && settled.nonce === nonce;
  const sameSource = settled?.fn === fn;
  const loading = !current && !(quiet && sameSource);
  return {
    data: current || (quiet && sameSource) ? settled?.data : undefined,
    error: current ? settled?.error : undefined,
    loading,
    reload,
    refresh,
  };
}
