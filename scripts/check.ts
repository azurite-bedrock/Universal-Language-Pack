// scripts/check.ts

/**
 * Parse a Minecraft .lang file into a key→value Map.
 * Skips comment lines (starting with #) and blank lines.
 * Values preserve everything after the first = on each line.
 */
export function parseLangFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    result.set(trimmed.substring(0, eqIdx), trimmed.substring(eqIdx + 1));
  }
  return result;
}

/**
 * Sort BDS version strings oldest-first using numeric component comparison.
 * e.g. ["1.20.0.1", "1.9.0.15"] → ["1.9.0.15", "1.20.0.1"]
 */
export function sortVersionsOldestFirst(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const ap = a.split(".").map(Number);
    const bp = b.split(".").map(Number);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
      const diff = (ap[i] ?? 0) - (bp[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

/**
 * Normalize a BDS locale code to Crowdin language ID format.
 * e.g. "de_DE" → "de-DE"
 */
export function normalizeLangCode(bdsCode: string): string {
  return bdsCode.replace("_", "-");
}

/**
 * Return versions from `all` that are not present in `handled`.
 */
export function computeUnhandled(all: string[], handled: string[]): string[] {
  const handledSet = new Set(handled);
  return all.filter((v) => !handledSet.has(v));
}

async function main(): Promise<void> {
  // Implemented in later tasks
}

if (import.meta.main) {
  await main();
}
