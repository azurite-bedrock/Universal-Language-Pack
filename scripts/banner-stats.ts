export interface TopLanguage {
    code: string; // "de_DE" (underscore-normalised from Crowdin's "de-DE")
    pct: number; // 0–100, translated
    approvedPct: number; // 0–100, proofread
}

export interface BannerStats {
    languages: number;
    overallProgress: number; // 0–100, weighted by word count
    overallApproved: number; // 0–100, proofread, weighted by word count
    sourceStrings: number; // strings.total (same for all languages)
    translators: number;
    topLanguages: TopLanguage[]; // sorted desc by pct + approvedPct, max 5
    generatedAt: string; // ISO timestamp
}

export interface ProgressItem {
    languageId: string;
    translationProgress: number;
    approvalProgress: number;
    words: { total: number; translated: number; approved: number };
}

export function computeStats(progressItems: ProgressItem[], translators: number): BannerStats {
    const totalWords = progressItems.reduce((sum, p) => sum + p.words.total, 0);
    const translatedWords = progressItems.reduce((sum, p) => sum + p.words.translated, 0);
    const approvedWords = progressItems.reduce((sum, p) => sum + p.words.approved, 0);
    const overallProgress =
        totalWords > 0 ? Math.round((translatedWords / totalWords) * 100) : 0;
    const overallApproved = totalWords > 0 ? Math.round((approvedWords / totalWords) * 100) : 0;

    const sourceStrings = progressItems.reduce((max, p) => Math.max(max, p.words.total), 0);

    const topLanguages = [...progressItems]
        .sort(
            (a, b) =>
                b.translationProgress +
                b.approvalProgress -
                (a.translationProgress + a.approvalProgress),
        )
        .slice(0, 5)
        .map((p) => ({
            code: p.languageId.replace(/-/g, '_'),
            pct: p.translationProgress,
            approvedPct: p.approvalProgress,
        }));

    return {
        languages: progressItems.length,
        overallProgress,
        overallApproved,
        sourceStrings,
        translators,
        topLanguages,
        generatedAt: new Date().toISOString(),
    };
}

/** Returns true if any stat visible on the banner has changed. Ignores generatedAt. */
export function hasChanged(prev: BannerStats, next: BannerStats): boolean {
    return (
        prev.languages !== next.languages ||
        prev.overallProgress !== next.overallProgress ||
        prev.overallApproved !== next.overallApproved ||
        prev.sourceStrings !== next.sourceStrings ||
        prev.translators !== next.translators ||
        JSON.stringify(prev.topLanguages) !== JSON.stringify(next.topLanguages)
    );
}
