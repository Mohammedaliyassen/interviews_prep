// lib/pb.ts
// PocketBase client — singleton for both client and server components

import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";

// ── Browser singleton ─────────────────────────────────────────────────────────
// Using a module-level variable so we don't create a new client on every render
let _pbBrowser: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (typeof window === "undefined") {
    // Server-side: always create a fresh instance (no cookie sharing between requests)
    return new PocketBase(PB_URL);
  }
  // Client-side: reuse the singleton so auth state persists
  if (!_pbBrowser) {
    _pbBrowser = new PocketBase(PB_URL);
    // Automatically refresh auth token from cookie if present, otherwise default to localStorage
    if (typeof document !== "undefined" && document.cookie.includes("pb_auth=")) {
      _pbBrowser.authStore.loadFromCookie(document.cookie);
    }
  }
  return _pbBrowser;
}

// Convenience default export for most usage
export const pb = typeof window !== "undefined" ? getPocketBase() : null;

export default getPocketBase;
