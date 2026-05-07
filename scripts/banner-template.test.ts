import { assertStringIncludes } from 'jsr:@std/assert';
import { renderBanner } from './banner-template.ts';
import type { BannerStats } from './banner-stats.ts';

const mockStats: BannerStats = {
    languages: 121,
    overallProgress: 68,
    sourceWords: 14753,
    translators: 247,
    topLanguages: [
        { code: 'de_DE', pct: 94 },
        { code: 'fr_FR', pct: 91 },
        { code: 'es_ES', pct: 87 },
        { code: 'ru_RU', pct: 82 },
        { code: 'ja_JP', pct: 79 },
    ],
    generatedAt: '2026-05-07T00:00:00.000Z',
};

Deno.test('renderBanner dark sets correct data-theme attribute', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, 'data-theme="dark"');
});

Deno.test('renderBanner light sets correct data-theme attribute', () => {
    const html = renderBanner(mockStats, 'light');
    assertStringIncludes(html, 'data-theme="light"');
});

Deno.test('renderBanner includes language count', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '121 Languages');
});

Deno.test('renderBanner includes source words with locale formatting', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '14,753 Words');
});

Deno.test('renderBanner includes translator count', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '247 Translators');
});

Deno.test('renderBanner includes overall progress percentage', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '68%');
});

Deno.test('renderBanner includes all top language codes', () => {
    const html = renderBanner(mockStats, 'dark');
    for (const lang of mockStats.topLanguages) {
        assertStringIncludes(html, lang.code);
    }
});

Deno.test('renderBanner includes remaining language count', () => {
    const html = renderBanner(mockStats, 'dark');
    // 121 - 5 = 116
    assertStringIncludes(html, '+ 116 more');
});

Deno.test('renderBanner sets progress bar width inline style', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, 'width:68%');
});

Deno.test('renderBanner sets each language bar width inline style', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, 'width:94%');
    assertStringIncludes(html, 'width:91%');
});

Deno.test('renderBanner is a complete HTML document', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '<!DOCTYPE html>');
    assertStringIncludes(html, '</html>');
});
