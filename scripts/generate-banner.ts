// scripts/generate-banner.ts
import CrowdinApi from 'npm:@crowdin/crowdin-api-client';
import { launch } from 'jsr:@astral/astral';
import prettier from 'npm:prettier';
import { join, toFileUrl } from 'jsr:@std/path';
import {
    computeStats,
    hasChanged,
    type BannerStats,
    type ProgressItem,
} from './banner-stats.ts';
import { renderBanner } from './banner-template.ts';

const PROJECT_ID = 775034;
const ASSETS_DIR = 'assets';
const SNAPSHOT_PATH = `${ASSETS_DIR}/banner-data.json`;

const BANNER_W = 1200;
const BANNER_H = 235;
const BANNER_SCALE = 1200 / 950;

async function loadSnapshot(): Promise<BannerStats | null> {
    try {
        return JSON.parse(await Deno.readTextFile(SNAPSHOT_PATH));
    } catch {
        return null;
    }
}

async function main(): Promise<void> {
    const token = Deno.env.get('CROWDIN_API');
    if (!token) throw new Error('CROWDIN_API env var is required');

    const crowdin = new CrowdinApi.default({ token });

    // Sequential fetches, do not parallelise
    console.log('Fetching language progress...');
    const progressResp = await crowdin.translationStatusApi.getProjectProgress(PROJECT_ID, {
        limit: 500,
    });

    console.log('Fetching project members...');
    const membersResp = await crowdin.usersApi.listProjectMembers(PROJECT_ID, { limit: 500 });

    const progressItems: ProgressItem[] = progressResp.data.map((item) => ({
        languageId: item.data.languageId,
        translationProgress: item.data.translationProgress,
        words: {
            total: item.data.words.total,
            translated: item.data.words.translated,
        },
    }));

    const translators = membersResp.data.length;
    const stats = computeStats(progressItems, translators);

    // Diff against snapshot
    const prev = await loadSnapshot();
    if (prev !== null && !hasChanged(prev, stats)) {
        console.log('No stats change - skipping banner regeneration.');
        return;
    }

    await Deno.mkdir(ASSETS_DIR, { recursive: true });

    // Persist snapshot
    await Deno.writeTextFile(SNAPSHOT_PATH, JSON.stringify(stats, null, 2) + '\n');
    console.log(
        `Stats: ${stats.languages} langs, ${stats.overallProgress}% overall, ${stats.translators} translators`,
    );

    // Render HTML for both themes and format with Prettier
    for (const theme of ['dark', 'light'] as const) {
        const html = renderBanner(stats, theme, BANNER_SCALE);
        const formatted = await prettier.format(html, { parser: 'html' });
        await Deno.writeTextFile(`${ASSETS_DIR}/banner-${theme}.html`, formatted);
        console.log(`Wrote ${ASSETS_DIR}/banner-${theme}.html`);
    }

    // Screenshot with Astral
    console.log('Launching browser...');
    const browser = await launch({ args: ['--force-device-scale-factor=3', '--no-sandbox'] });
    try {
        for (const theme of ['dark', 'light'] as const) {
            const page = await browser.newPage();
            try {
                await page.setViewportSize({ width: BANNER_W, height: BANNER_H });
                const htmlPath = toFileUrl(
                    join(Deno.cwd(), ASSETS_DIR, `banner-${theme}.html`),
                ).href;
                await page.goto(htmlPath); // waits for 'load' event by default
                await page.waitForTimeout(1200); // let Google Fonts load + CSS animations complete
                // Transparent background: Astral exposes raw CDP domains via unsafelyGetCelestialBindings()
                const cdp = page.unsafelyGetCelestialBindings();
                await cdp.Emulation.setDefaultBackgroundColorOverride({
                    color: { r: 0, g: 0, b: 0, a: 0 },
                });
                const png = await page.screenshot();
                await cdp.Emulation.setDefaultBackgroundColorOverride({});
                await Deno.writeFile(`${ASSETS_DIR}/banner-${theme}.png`, png);
                console.log(`Wrote ${ASSETS_DIR}/banner-${theme}.png`);
            } finally {
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }

    console.log('Done.');
}

if (import.meta.main) {
    await main();
}
