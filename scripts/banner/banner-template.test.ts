import { assertStringIncludes } from 'jsr:@std/assert';
import { renderBanner } from './banner-template.ts';
import type { BannerStats } from './banner-stats.ts';

const mockStats: BannerStats = {
    languages: 121,
    overallProgress: 68,
    overallApproved: 41,
    sourceStrings: 14753,
    translators: 247,
    topLanguages: [
        { code: 'de_DE', pct: 94, approvedPct: 63 },
        { code: 'fr_FR', pct: 91, approvedPct: 52 },
        { code: 'es_ES', pct: 87, approvedPct: 44 },
        { code: 'ru_RU', pct: 82, approvedPct: 31 },
        { code: 'ja_JP', pct: 79, approvedPct: 22 },
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

Deno.test('renderBanner includes source strings with locale formatting', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '14,753 Strings');
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

Deno.test('renderBanner sets proofread overlay width on the main bar', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '<div class="prog-appr" style="width:41%"></div>');
});

Deno.test('renderBanner sets proofread overlay width on each language bar', () => {
    const html = renderBanner(mockStats, 'dark');
    for (const lang of mockStats.topLanguages) {
        assertStringIncludes(
            html,
            `<div class="lang-appr" style="width:${lang.approvedPct}%"></div>`,
        );
    }
});

Deno.test('renderBanner shows translated · proofread in the progress header', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(
        html,
        '<span class="pct-tr">68%</span> · <span class="pct-pr">41%</span>',
    );
});

Deno.test('renderBanner shows translated · proofread per language row', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(
        html,
        '<span class="pct-tr">94%</span> · <span class="pct-pr">63%</span>',
    );
    assertStringIncludes(
        html,
        '<span class="pct-tr">91%</span> · <span class="pct-pr">52%</span>',
    );
});

Deno.test('renderBanner right-aligns the update note in the legend row', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '<span class="updated">updated every 6h</span>');
});

Deno.test('renderBanner includes translated/proofread legend', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '<span class="legend-dot legend-tr"></span> translated');
    assertStringIncludes(html, '<span class="legend-dot legend-pr"></span> proofread');
});

Deno.test('renderBanner mutes 0% values and drops the divider shadow', () => {
    const zeroStats: BannerStats = {
        ...mockStats,
        topLanguages: [{ code: 'xx_XX', pct: 0, approvedPct: 0 }],
    };
    const html = renderBanner(zeroStats, 'dark');
    assertStringIncludes(
        html,
        '<span class="pct-tr pct-zero">0%</span> · <span class="pct-pr pct-zero">0%</span>',
    );
    assertStringIncludes(html, 'class="lang-appr appr-zero"');
});

Deno.test('renderBanner is a complete HTML document', () => {
    const html = renderBanner(mockStats, 'dark');
    assertStringIncludes(html, '<!DOCTYPE html>');
    assertStringIncludes(html, '</html>');
});
