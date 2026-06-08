import { tokens } from "../data/tokens";

export type Route = { tokenId?: string; chainId?: number };

/** Parse the location hash into a route: `#/usdt` or `#/usdt/1`. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "").trim();
  if (!raw) return {};
  const [tokenId, chainStr] = raw.split("/");
  const valid = tokens.some((t) => t.id === tokenId);
  if (!valid) return {};
  const chainId = chainStr ? Number(chainStr) : NaN;
  return { tokenId, chainId: Number.isFinite(chainId) ? chainId : undefined };
}

/** Build a hash fragment for a token, optionally scoped to one chain. */
export function buildHash(tokenId: string, chainId: number | null): string {
  return chainId == null ? `#/${tokenId}` : `#/${tokenId}/${chainId}`;
}

/** Absolute, shareable URL for a token (+ optional chain). */
export function shareUrl(tokenId: string, chainId: number | null): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${buildHash(tokenId, chainId)}`;
}
