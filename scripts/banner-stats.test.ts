import { assertEquals } from 'jsr:@std/assert';
import { computeStats, hasChanged } from './banner-stats.ts';

const mockProgress = [
    {
        languageId: 'de-DE',
        translationProgress: 94,
        approvalProgress: 60,
        words: { total: 1000, translated: 940, approved: 600 },
    },
    {
        languageId: 'fr-FR',
        translationProgress: 91,
        approvalProgress: 45,
        words: { total: 1000, translated: 910, approved: 450 },
    },
    {
        languageId: 'es-ES',
        translationProgress: 87,
        approvalProgress: 30,
        words: { total: 1000, translated: 870, approved: 300 },
    },
    {
        languageId: 'ru-RU',
        translationProgress: 82,
        approvalProgress: 20,
        words: { total: 1000, translated: 820, approved: 200 },
    },
    {
        languageId: 'ja-JP',
        translationProgress: 79,
        approvalProgress: 10,
        words: { total: 1000, translated: 790, approved: 100 },
    },
    {
        languageId: 'pt-BR',
        translationProgress: 60,
        approvalProgress: 5,
        words: { total: 1000, translated: 600, approved: 50 },
    },
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

Deno.test('computeStats computes overallApproved as weighted word percentage', () => {
    const stats = computeStats(mockProgress, 50);
    // (600+450+300+200+100+50) / (6*1000) = 1700/6000 = 0.2833... -> 28
    assertEquals(stats.overallApproved, 28);
});

Deno.test('computeStats uses maximum words.total across all items as sourceStrings', () => {
    const stats = computeStats(mockProgress, 50);
    assertEquals(stats.sourceStrings, 1000);
});

Deno.test('computeStats passes through translator count', () => {
    const stats = computeStats(mockProgress, 247);
    assertEquals(stats.translators, 247);
});

Deno.test('computeStats returns top 5 languages sorted desc by combined score', () => {
    const stats = computeStats(mockProgress, 50);
    assertEquals(stats.topLanguages, [
        { code: 'de_DE', pct: 94, approvedPct: 60 },
        { code: 'fr_FR', pct: 91, approvedPct: 45 },
        { code: 'es_ES', pct: 87, approvedPct: 30 },
        { code: 'ru_RU', pct: 82, approvedPct: 20 },
        { code: 'ja_JP', pct: 79, approvedPct: 10 },
    ]);
});

Deno.test('computeStats ranks by translated% + proofread%, not translated% alone', () => {
    const items = [
        {
            languageId: 'aa-AA',
            translationProgress: 100,
            approvalProgress: 10, // score 110
            words: { total: 100, translated: 100, approved: 10 },
        },
        {
            languageId: 'bb-BB',
            translationProgress: 90,
            approvalProgress: 80, // score 170
            words: { total: 100, translated: 90, approved: 80 },
        },
        {
            languageId: 'cc-CC',
            translationProgress: 95,
            approvalProgress: 40, // score 135
            words: { total: 100, translated: 95, approved: 40 },
        },
    ];
    const stats = computeStats(items, 1);
    assertEquals(
        stats.topLanguages.map((l) => l.code),
        ['bb_BB', 'cc_CC', 'aa_AA'],
    );
});

Deno.test('computeStats normalises language IDs from hyphen to underscore', () => {
    const stats = computeStats(
        [
            {
                languageId: 'zh-TW',
                translationProgress: 50,
                approvalProgress: 25,
                words: { total: 100, translated: 50, approved: 25 },
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
    assertEquals(stats.overallApproved, 0);
    assertEquals(stats.sourceStrings, 0);
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

Deno.test('hasChanged returns true when overallApproved differs', () => {
    const a = computeStats(mockProgress, 50);
    const b = computeStats(
        mockProgress.map((p) => ({
            ...p,
            words: { ...p.words, approved: p.words.approved + 100 },
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

Deno.test('hasChanged returns true when top language approvedPct differs', () => {
    const a = computeStats(mockProgress, 50);
    const changed = mockProgress.map((p, i) => (i === 0 ? { ...p, approvalProgress: 99 } : p));
    const b = computeStats(changed, 50);
    assertEquals(hasChanged(a, b), true);
});

Deno.test('hasChanged returns true when language count differs', () => {
    const a = computeStats(mockProgress, 50);
    const b = computeStats(mockProgress.slice(0, 5), 50);
    assertEquals(hasChanged(a, b), true);
});

Deno.test('hasChanged returns true when sourceStrings differs', () => {
    const a = computeStats(mockProgress, 50);
    const bigger = mockProgress.map((p) => ({
        ...p,
        words: { ...p.words, total: p.words.total + 100 },
    }));
    const b = computeStats(bigger, 50);
    assertEquals(hasChanged(a, b), true);
});
