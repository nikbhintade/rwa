import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TokenDetail } from "./components/TokenDetail";
import { tokens } from "./data/tokens";
import {
  assembleFromChainStats,
  fetchAllStats,
  fetchTokenDetail,
  STABLECOIN_ENDPOINT,
  STOCKS_ENDPOINT,
  type ChainStatsMap,
} from "./lib/gql";
import { buildHash, parseHash } from "./lib/router";
import type { Token, TokenStats } from "./types";

const tokenById = new Map(tokens.map((t) => [t.id, t]));

// Live asset classes, grouped by which indexer serves them. Treasuries/credit
// are gated off in the UI and not yet indexed, so we don't query their stats.
const stablecoinTokens = tokens.filter((t) => t.assetClass === "stablecoin");
const stockTokens = tokens.filter((t) => t.assetClass === "stock");

function App() {
  const [selected, setSelected] = useState<Token | undefined>();
  // null = all chains; otherwise the shared/selected chain filter.
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [stats, setStats] = useState<ChainStatsMap>({});
  const [detailCache, setDetailCache] = useState<Record<string, TokenStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply a route to component state, only validating the chain against the token.
  const applyRoute = useCallback((tokenId?: string, chainId?: number) => {
    const token = tokenId ? tokenById.get(tokenId) : undefined;
    setSelected(token);
    const validChain =
      token && chainId != null && token.chains.some((c) => c.chainId === chainId)
        ? chainId
        : null;
    setChainFilter(validChain);
  }, []);

  // Initial load + browser back/forward: drive state from the URL hash.
  useEffect(() => {
    const sync = () => {
      const { tokenId, chainId } = parseHash(window.location.hash);
      applyRoute(tokenId, chainId);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [applyRoute]);

  useEffect(() => {
    let cancelled = false;
    // Each indexer is queried independently and the maps merged. allSettled keeps
    // one endpoint's failure from blanking the other (keys never collide — they're
    // chainId:address and the address sets are disjoint).
    Promise.allSettled([
      fetchAllStats(stablecoinTokens, STABLECOIN_ENDPOINT),
      stockTokens.length
        ? fetchAllStats(stockTokens, STOCKS_ENDPOINT)
        : Promise.resolve<ChainStatsMap>({}),
    ])
      .then((results) => {
        if (cancelled) return;
        const merged: ChainStatsMap = {};
        let anyOk = false;
        let firstError: string | null = null;
        for (const r of results) {
          if (r.status === "fulfilled") {
            Object.assign(merged, r.value);
            anyOk = true;
          } else if (!firstError) {
            firstError = r.reason instanceof Error ? r.reason.message : String(r.reason);
          }
        }
        setStats(merged);
        if (!anyOk && firstError) setError(firstError);
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

  // Keep the URL in sync with the current selection + chain filter.
  const navigate = useCallback((tokenId: string, chainId: number | null) => {
    const next = buildHash(tokenId, chainId);
    if (window.location.hash !== next) window.location.hash = next;
  }, []);

  const handleSelect = useCallback(
    (token: Token) => {
      setSelected(token);
      setChainFilter(null);
      navigate(token.id, null);
    },
    [navigate],
  );

  const handleChainFilter = useCallback(
    (chainId: number | null) => {
      setChainFilter(chainId);
      if (selected) navigate(selected.id, chainId);
    },
    [selected, navigate],
  );

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
            chainFilter={chainFilter}
            onChainFilter={handleChainFilter}
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
