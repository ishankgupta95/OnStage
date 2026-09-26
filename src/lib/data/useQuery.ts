"use client";

import { useEffect, useRef, useState } from "react";

export type QueryState<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * A very small async-read hook. The backend is async on purpose, so the
 * loading and error branches in the UI are real from day one and nothing has
 * to be retrofitted when Supabase lands.
 *
 * `key` identifies the read; changing it refetches and, until the new result
 * arrives, the hook reports loading — derived during render rather than by
 * setting state in an effect.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>): QueryState<T> {
  const latest = useRef(fetcher);
  useEffect(() => {
    latest.current = fetcher;
  });

  const [result, setResult] = useState<{ key: string; data?: T; error: string | null }>({
    key: "",
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    latest.current().then(
      (data) => {
        if (alive) setResult({ key, data, error: null });
      },
      (e: unknown) => {
        if (alive) {
          setResult({ key, error: e instanceof Error ? e.message : "Something went wrong" });
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [key, nonce]);

  const fresh = result.key === key;
  return {
    data: fresh ? result.data : undefined,
    loading: !fresh,
    error: fresh ? result.error : null,
    refetch: () => setNonce((n) => n + 1),
  };
}
