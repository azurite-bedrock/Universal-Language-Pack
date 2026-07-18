export interface LocaleEntry {
    identifier: string;
    source_string: string;
    translation: string;
    context: string | null;
    labels: string | null;
    max_length: number | null;
}

// Flip map derived from the characters already shipped in locales/en_UD.json,
// so every symbol is known to render in both JSON UI and Ore UI. Digits are
// left as-is (matching the shipped file), as are characters without a
// BMP-safe upside-down form.
const FLIP_MAP: Record<string, string> = {
    a: 'ɐ',
    b: 'q',
    c: 'ɔ',
    d: 'p',
    e: 'ǝ',
    f: 'ɟ',
    g: 'ᵷ',
    h: 'ɥ',
    i: 'ᴉ',
    j: 'ɾ',
    k: 'ʞ',
    l: 'ꞁ',
    m: 'ɯ',
    n: 'u',
    p: 'd',
    q: 'b',
    r: 'ɹ',
    t: 'ʇ',
    u: 'n',
    v: 'ʌ',
    w: 'ʍ',
    y: 'ʎ',
    A: 'Ɐ',
    B: 'ᗺ',
    C: 'Ɔ',
    D: 'ᗡ',
    E: 'Ǝ',
    F: 'Ⅎ',
    G: '⅁',
    J: 'Ր',
    K: 'Ʞ',
    L: 'Ꞁ',
    M: 'W',
    P: 'Ԁ',
    Q: 'Ꝺ',
    R: 'ᴚ',
    T: '⟘',
    U: '∩',
    V: 'Ʌ',
    W: 'M',
    Y: '⅄',
    '!': '¡',
    '?': '¿',
    '.': '˙',
    ',': "'",
    "'": ',',
    '’': ',',
    '&': '⅋',
    '(': ')',
    ')': '(',
    '[': ']',
    ']': '[',
    '<': '>',
    '>': '<',
};

// Minecraft placeholders (%s, %d, %1$s, %%) and formatting codes (§x).
const TOKEN_RE = /(%(?:\d+\$)?[a-zA-Z]|%%|§.)/;
const UNNUMBERED_RE = /^%[a-zA-Z]$/;

function flipChars(text: string): string {
    return [...text]
        .map((c) => FLIP_MAP[c] ?? c)
        .reverse()
        .join('');
}

/**
 * Turns a string upside down: characters are flipped and reading order is
 * reversed, while placeholders and § formatting codes stay intact.
 *
 * - Unnumbered placeholders are renumbered (%s → %1$s) when there is more
 *   than one, so arguments keep their meaning after the reversal.
 * - § codes style the text that follows them; reversal happens within each
 *   styled run so codes keep applying to the same text.
 */
export function flipString(text: string): string {
    let parts = text.split(TOKEN_RE);

    const unnumbered = parts.filter((p) => UNNUMBERED_RE.test(p)).length;
    if (unnumbered > 1) {
        let arg = 0;
        parts = parts.map((p) => (UNNUMBERED_RE.test(p) ? `%${++arg}$${p[1]}` : p));
    }

    // Group parts into styled runs: a § code plus everything up to the next one.
    const runs: string[][] = [[]];
    for (const part of parts) {
        if (part.startsWith('§')) runs.push([part]);
        else runs.at(-1)!.push(part);
    }

    return runs
        .map((run) => {
            const code = run[0]?.startsWith('§') ? run.shift()! : '';
            const flipped = run
                .map((p) => (TOKEN_RE.test(p) ? p : flipChars(p)))
                .reverse()
                .join('');
            return code + flipped;
        })
        .join('');
}

/** Identifiers that must stay readable, with an optional fixed translation. */
const OVERRIDES: Record<string, string | null> = {
    'language.name': 'English (Upside Down)',
    'pack.name': null, // null = keep the en_US translation as-is
    'pack.description': null,
};

/** TTS strings are spoken by screen readers; flipped chars would be gibberish. */
function isSpoken(identifier: string): boolean {
    return identifier.startsWith('accessibility.') || identifier.includes('.tts');
}

/** Builds the en_UD locale from the en_US one. */
export function buildUpsideDownLocale(enUS: LocaleEntry[]): LocaleEntry[] {
    return enUS.map((entry) => {
        let translation: string;
        if (entry.identifier in OVERRIDES) {
            translation = OVERRIDES[entry.identifier] ?? entry.translation;
        } else if (isSpoken(entry.identifier)) {
            translation = entry.translation;
        } else {
            translation = flipString(entry.translation);
        }
        return { ...entry, translation };
    });
}
