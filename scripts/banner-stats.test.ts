import { assertEquals } from 'jsr:@std/assert';
import { computeStats, hasChanged } from './banner-stats.ts';

const mockProgress = [
    { languageId: 'de-DE', translationProgress: 94, words: { total: 1000, translated: 940 } },
    { languageId: 'fr-FR', translationProgress: 91, words: { total: 1000, translated: 910 } },
    { languageId: 'es-ES', translationProgress: 87, words: { total: 1000, translated: 870 } },
    { languageId: 'ru-RU', translationProgress: 82, words: { total: 1000, translated: 820 } },
    { languageId: 'ja-JP', translationProgress: 79, words: { total: 1000, translated: 790 } },
    { languageId: 'pt-BR', translationProgress: 60, words: { total: 1000, translated: 600 } },
];

Deno.test('computeStats counts languages correctly', () => {
    const stats = computeStats(mockProgress, 50);
    assertEquals(stats.languages, 6);
});

Deno.test('computeStats computes overallProgress as weighted word percentage', () => {
    const stats = computeStats(mockProgress, 50);
    // (940+910+870+820+790+600) / (6*1000) = 4930/6000 = 0.8216... -> 82
    assertEquals(stats.overallProgress, 82);
});

Deno.test('computeStats uses maximum words.total across all items as sourceWords', () => {
    const stats = computeStats(mockProgress, 50);
    assertEquals(stats.sourceWords, 1000);
});

Deno.test('computeStats passes through translator count', () => {
    const stats = computeStats(mockProgress, 247);
    assertEquals(stats.translators, 247);
});

Deno.test('computeStats returns top 5 languages sorted desc by translationProgress', () => {
    const stats = computeStats(mockProgress, 50);
    assertEquals(stats.topLanguages, [
        { code: 'de_DE', pct: 94 },
        { code: 'fr_FR', pct: 91 },
        { code: 'es_ES', pct: 87 },
        { code: 'ru_RU', pct: 82 },
        { code: 'ja_JP', pct: 79 },
    ]);
});

Deno.test('computeStats normalises language IDs from hyphen to underscore', () => {
    const stats = computeStats(
        [
            {
                languageId: 'zh-TW',
                translationProgress: 50,
                words: { total: 100, translated: 50 },
            },
        ],
        1,
    );
    assertEquals(stats.topLanguages[0].code, 'zh_TW');
});

Deno.test('computeStats handles empty progress array', () => {
    const stats = computeStats([], 0);
    assertEquals(stats.languages, 0);
    assertEquals(stats.overallProgress, 0);
    assertEquals(stats.sourceWords, 0);
    assertEquals(stats.topLanguages, []);
});

Deno.test('hasChanged returns false when stats are identical', () => {
    const stats = computeStats(mockProgress, 50);
    assertEquals(hasChanged(stats, computeStats(mockProgress, 50)), false);
});

Deno.test('hasChanged returns true when overallProgress differs', () => {
    const a = computeStats(mockProgress, 50);
    const b = computeStats(
        mockProgress.map((p) => ({
            ...p,
            words: { ...p.words, translated: p.words.translated - 10 },
        })),
        50,
    );
    assertEquals(hasChanged(a, b), true);
});

Deno.test('hasChanged returns true when translator count differs', () => {
    const a = computeStats(mockProgress, 50);
    const b = computeStats(mockProgress, 51);
    assertEquals(hasChanged(a, b), true);
});

Deno.test('hasChanged returns true when top language pct differs', () => {
    const a = computeStats(mockProgress, 50);
    const changed = mockProgress.map((p, i) =>
        i === 0 ? { ...p, translationProgress: 70 } : p,
    );
    const b = computeStats(changed, 50);
    assertEquals(hasChanged(a, b), true);
});

Deno.test('hasChanged returns true when language count differs', () => {
    const a = computeStats(mockProgress, 50);
    const b = computeStats(mockProgress.slice(0, 5), 50);
    assertEquals(hasChanged(a, b), true);
});

Deno.test('hasChanged returns true when sourceWords differs', () => {
    const a = computeStats(mockProgress, 50);
    const bigger = mockProgress.map((p) => ({
        ...p,
        words: { ...p.words, total: p.words.total + 100 },
    }));
    const b = computeStats(bigger, 50);
    assertEquals(hasChanged(a, b), true);
});
