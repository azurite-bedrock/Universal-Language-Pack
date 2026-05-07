export interface TopLanguage {
    code: string; // "de_DE" (underscore-normalised from Crowdin's "de-DE")
    pct: number; // 0–100
}

export interface BannerStats {
    languages: number;
    overallProgress: number; // 0–100, weighted by word count
    sourceWords: number; // words.total (same for all languages)
    translators: number;
    topLanguages: TopLanguage[]; // sorted desc, max 5
    generatedAt: string; // ISO timestamp
}

export interface ProgressItem {
    languageId: string;
    translationProgress: number;
    words: { total: number; translated: number };
}

export function computeStats(progressItems: ProgressItem[], translators: number): BannerStats {
    const totalWords = progressItems.reduce((sum, p) => sum + p.words.total, 0);
    const translatedWords = progressItems.reduce((sum, p) => sum + p.words.translated, 0);
    const overallProgress =
        totalWords > 0 ? Math.round((translatedWords / totalWords) * 100) : 0;

    const sourceWords = progressItems.reduce((max, p) => Math.max(max, p.words.total), 0);

    const topLanguages = [...progressItems]
        .sort((a, b) => b.translationProgress - a.translationProgress)
        .slice(0, 5)
        .map((p) => ({
            code: p.languageId.replace(/-/g, '_'),
            pct: p.translationProgress,
        }));

    return {
        languages: progressItems.length,
        overallProgress,
        sourceWords,
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
        prev.sourceWords !== next.sourceWords ||
        prev.translators !== next.translators ||
        JSON.stringify(prev.topLanguages) !== JSON.stringify(next.topLanguages)
    );
}
