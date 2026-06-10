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
import { buildHash, parseHash } from "./lib/router";
import type { Token, TokenStats } from "./types";

const tokenById = new Map(tokens.map((t) => [t.id, t]));

// Only stablecoins are surfaced for now; US Treasuries are gated off in the UI
// and not yet indexed, so we don't query their stats.
const activeTokens = tokens.filter((t) => t.assetClass === "stablecoin");

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
    fetchAllStats(activeTokens)
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
