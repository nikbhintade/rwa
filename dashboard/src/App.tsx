import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TokenDetail } from "./components/TokenDetail";
import { tokens } from "./data/tokens";
import {
  assembleFromChainStats,
  fetchAllStats,
  fetchTokenDetail,
  type ChainStatsMap,
} from "./lib/gql";
import type { Token, TokenStats } from "./types";

function App() {
  const [selected, setSelected] = useState<Token | undefined>();
  const [stats, setStats] = useState<ChainStatsMap>({});
  const [detailCache, setDetailCache] = useState<Record<string, TokenStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllStats(tokens)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (detailCache[selected.id]) return;
    let cancelled = false;
    const token = selected;
    fetchTokenDetail(token)
      .then((s) => {
        if (cancelled) return;
        setDetailCache((c) => ({ ...c, [token.id]: s }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected, detailCache]);

  const handleSelect = useCallback((token: Token) => setSelected(token), []);

  const fallbackStats = useMemo(
    () => (selected ? assembleFromChainStats(selected, stats) : undefined),
    [selected, stats],
  );

  return (
    <div className="flex h-screen w-screen bg-[var(--color-bg-base)]">
      <Sidebar
        selectedId={selected?.id}
        onSelect={handleSelect}
        stats={stats}
        loading={loading}
      />
      <main className="flex-1 overflow-auto">
        {selected ? (
          <TokenDetail
            token={selected}
            sidebarStats={fallbackStats}
            detailStats={detailCache[selected.id]}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-text-muted)]">
            {error ? (
              <span className="text-[var(--color-neg)]">{error}</span>
            ) : (
              "Select a token"
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
