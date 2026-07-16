import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { bottts, botttsNeutral, shapes, glass, rings, identicon, thumbs } from "@dicebear/collection";

// Requires: npm install @dicebear/core @dicebear/collection
// Avatars are generated LOCALLY (no api.dicebear.com request), so they're instant,
// offline-safe, deterministic, and unique per seed (e.g. a wallet address).

const STYLES = { bottts, botttsNeutral, shapes, glass, rings, identicon, thumbs };

/**
 * Avatar — a deterministic DiceBear avatar.
 * @param {string} seed    stable id (wallet address, vault id, …)
 * @param {string} [style] one of: bottts | botttsNeutral | shapes | glass | rings | identicon | thumbs
 * @param {number} [size]  px (display size)
 * @param {number} [radius] corner rounding 0–50 (% of viewBox)
 */
export default function Avatar({ seed, style = "bottts", size = 32, radius = 16, className = "" }) {
  const uri = useMemo(() => {
    const s = STYLES[style] || bottts;
    try {
      return createAvatar(s, { seed: String(seed ?? "aussivo"), radius }).toDataUri();
    } catch {
      return null;
    }
  }, [seed, style, radius]);

  if (!uri) {
    return <div className={className} style={{ width: size, height: size, background: "#1e293b", borderRadius: `${radius}%` }} />;
  }
  return <img src={uri} alt="" width={size} height={size} className={className} loading="lazy" />;
}