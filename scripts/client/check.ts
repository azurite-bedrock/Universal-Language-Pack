import CrowdinApi from 'npm:@crowdin/crowdin-api-client';
import { join } from 'jsr:@std/path';
import { authorizeForUpdateService } from './xbox-auth.ts';
import { type ClientPackage, discoverClientPackages } from './discover.ts';
import {
    buildCikFile,
    collectLangFiles,
    extractPackage,
    parseCikSecret,
    readPackageKeyId,
} from './xvdtool.ts';

type CrowdinClient = InstanceType<typeof CrowdinApi.default>;

const PROJECT_ID = 775034;

const HANDLED_VERSIONS_PATH = 'handled-versions.json';

/**
 * Parse a Minecraft .lang file into a key->value Map.
 * Skips comment lines (starting with #) and blank lines.
 * Strips inline ## comments from values and trims trailing whitespace.
 */
export function parseLangFile(content: string): Map<string, string> {
    const result = new Map<string, string>();
    for (const line of content.replace(/^\uFEFF/, '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const raw = trimmed.substring(eqIdx + 1);
        const commentIdx = raw.indexOf('##');
        const key = trimmed.substring(0, eqIdx).trimEnd();
        const value = (commentIdx !== -1 ? raw.substring(0, commentIdx) : raw).trimEnd();
        result.set(key, value);
    }
    return result;
}

/**
 * Sort version strings oldest-first using numeric component comparison.
 * e.g. ["1.20.0.1", "1.9.0.15"] -> ["1.9.0.15", "1.20.0.1"]
 */
export function sortVersionsOldestFirst(versions: string[]): string[] {
    return [...versions].sort((a, b) => {
        const ap = a.split('.').map(Number);
        const bp = b.split('.').map(Number);
        for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
            const diff = (ap[i] ?? 0) - (bp[i] ?? 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });
}

/**
 * Normalize a Minecraft locale code to Crowdin language ID format.
 * e.g. "de_DE" -> "de-DE"
 */
export function normalizeLangCode(mcCode: string): string {
    return mcCode.replace(/_/g, '-');
}

/**
 * Return versions from `all` that are not present in `handled`.
 */
export function computeUnhandled(all: string[], handled: string[]): string[] {
    const handledSet = new Set(handled);
    return all.filter((v) => !handledSet.has(v));
}

/**
 * XvdTool does not fail on a wrong or malformed CIK- it happily writes
 * ciphertext with the right file names and sizes. Refuse to continue unless
 * vanilla/en_US.lang came out as readable key=value text.
 */
export function assertDecrypted(raw: Map<string, Map<string, string>>): void {
    const enUS = raw.get('vanilla')?.get('en_US');
    if (!enUS) {
        throw new Error('No vanilla/texts/en_US.lang in package- extraction failed?');
    }
    if (enUS.includes('\0') || parseLangFile(enUS).size === 0) {
        throw new Error(
            'vanilla/en_US.lang is not readable text- CIK did not decrypt the package',
        );
    }
}

/**
 * Stream-extract a client package and parse every .lang file in it.
 * Every resource pack with a texts/ folder is included, so packs Mojang adds
 * later (oreui, persona, ...) are picked up without code changes.
 *
 * Returns: Map<packName, Map<langCode, Map<key, value>>>
 * e.g. "vanilla" -> "de_DE" -> "accessibility.foo" -> "Barrierefreiheit"
 */
export async function extractLangFiles(
    pkg: ClientPackage,
    cikPath: string,
): Promise<Map<string, Map<string, Map<string, string>>>> {
    const outputDir = await Deno.makeTempDir({ prefix: 'mc-client-' });
    try {
        await extractPackage(pkg.urls[0], cikPath, outputDir);
        const raw = await collectLangFiles(outputDir);
        assertDecrypted(raw);

        const packs = new Map<string, Map<string, Map<string, string>>>();
        for (const [packName, langs] of raw) {
            const parsed = new Map<string, Map<string, string>>();
            for (const [langCode, content] of langs)
                parsed.set(langCode, parseLangFile(content));
            packs.set(packName, parsed);
        }
        return packs;
    } finally {
        await Deno.remove(outputDir, { recursive: true }).catch(() => {});
    }
}

/**
 * Fetch the Crowdin language map for this project.
 * Returns Map<minecraftLocaleCode, crowdinLanguageId>
 * e.g. "de_DE" -> "de", "zh_TW" -> "zh-TW", "pt_BR" -> "pt-BR"
 * Uses the project's own targetLanguages list - the only reliable source of truth.
 */
export async function fetchProjectLanguageMap(
    crowdin: CrowdinClient,
): Promise<Map<string, string>> {
    const project = await crowdin.projectsGroupsApi.getProject(PROJECT_ID);
    const map = new Map<string, string>();
    for (const lang of project.data.targetLanguages) {
        // lang.locale = "de-DE", lang.id = "de"
        const mcCode = lang.locale.replace(/-/g, '_');
        map.set(mcCode, lang.id);
    }
    return map;
}

/**
 * Fetch ALL source strings from the Crowdin project (paginated, 500 per page).
 * Returns Map<identifier, { id, text }>.
 * Called once at startup- never again during a run- to avoid hammering the
 * API across 80k+ strings.
 */
export async function fetchAllCrowdinStrings(
    crowdin: CrowdinClient,
): Promise<Map<string, { id: number; text: string }>> {
    const result = new Map<string, { id: number; text: string }>();
    const limit = 500;
    let offset = 0;

    while (true) {
        const resp = await crowdin.sourceStringsApi.listProjectStrings(PROJECT_ID, {
            limit,
            offset,
        });
        for (const item of resp.data) {
            const { id, identifier, text } = item.data;
            result.set(identifier, { id, text: text as string });
        }
        // A project with exactly N*500 strings will make one extra empty-page
        // request before breaking- acceptable since the SDK has no typed total count.
        if (resp.data.length < limit) break;
        offset += limit;
    }

    return result;
}

/** Parallel translation uploads per string. Crowdin allows ~20 req/s. */
const TRANSLATION_CONCURRENCY = 8;

/**
 * Run `fn` over `items` with at most `limit` in flight at once.
 */
export async function mapWithConcurrency<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            await fn(item);
        }
    });
    await Promise.all(workers);
}

/**
 * Upload a new source string to Crowdin and immediately upload
 * all available translations for it.
 *
 * Uses the stringId from the addString response directly- never re-queries
 * Crowdin for the new string, avoiding eventual-consistency issues.
 *
 * Returns the new Crowdin string ID.
 */
async function uploadStringWithTranslations(
    crowdin: CrowdinClient,
    identifier: string,
    enValue: string,
    translations: Map<string, string>, // Minecraft locale code (de_DE) -> translated text
    langMap: Map<string, string>, // Minecraft locale code -> Crowdin language ID
    warnings: Map<string, number>, // warning reason -> count, summarised at the end
): Promise<number> {
    const addResp = await crowdin.sourceStringsApi.addString(PROJECT_ID, {
        identifier,
        text: enValue,
        branchId: 5, // main
    });
    const stringId = addResp.data.id;

    // Several Minecraft locales can map to one Crowdin language; upload each once.
    const byCrowdinLang = new Map<string, string>();
    for (const [mcCode, text] of translations) {
        const crowdinLang = langMap.get(mcCode);
        if (crowdinLang && !byCrowdinLang.has(crowdinLang))
            byCrowdinLang.set(crowdinLang, text);
    }

    await mapWithConcurrency(
        [...byCrowdinLang],
        TRANSLATION_CONCURRENCY,
        async ([languageId, text]) => {
            try {
                await crowdin.stringTranslationsApi.addTranslation(PROJECT_ID, {
                    stringId,
                    languageId,
                    text,
                });
            } catch (e) {
                const reason = String(e).replace(/^Error: /, '');
                warnings.set(reason, (warnings.get(reason) ?? 0) + 1);
            }
        },
    );

    return stringId;
}

async function main(): Promise<void> {
    const crowdin = new CrowdinApi.default({ token: Deno.env.get('CROWDIN_API')! });

    const refreshToken = Deno.env.get('XBOX_REFRESH_TOKEN');
    const cikSecret = Deno.env.get('XVC_CIK');
    if (!refreshToken || !cikSecret) {
        throw new Error('XBOX_REFRESH_TOKEN and XVC_CIK must be set');
    }

    // Discover current release + preview client packages
    console.log('Authenticating with Xbox Live...');
    const auth = await authorizeForUpdateService(refreshToken);
    // Refresh tokens rotate; hand the new one back to the workflow so it can be re-stored.
    const refreshTokenOut = Deno.env.get('XBOX_REFRESH_TOKEN_OUT');
    if (refreshTokenOut && auth.refreshToken !== refreshToken) {
        await Deno.writeTextFile(refreshTokenOut, auth.refreshToken);
    }

    console.log('Discovering client packages...');
    const allEntries = await discoverClientPackages(auth);
    for (const pkg of allEntries)
        console.log(`  ${pkg.channel}: ${pkg.version} (${pkg.fileName})`);
    const versionToEntry = new Map(allEntries.map((e) => [e.version, e]));

    // Read persisted handled versions
    let handled: string[] = [];
    try {
        const raw = await Deno.readTextFile(HANDLED_VERSIONS_PATH);
        handled = JSON.parse(raw);
    } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) {
            throw new Error(`Failed to parse ${HANDLED_VERSIONS_PATH}: ${e}`);
        }
        // File doesn't exist on first run- start empty
    }

    // Compute unhandled versions, sorted oldest-first
    const unhandled = sortVersionsOldestFirst(
        computeUnhandled(
            allEntries.map((e) => e.version),
            handled,
        ),
    );

    if (unhandled.length === 0) {
        console.log('No new client versions to process. Exiting.');
        return;
    }

    // Materialise the content keys for XvdTool, one file per key ID
    const cikDir = await Deno.makeTempDir({ prefix: 'cik-' });
    const cikPaths = new Map<string, string>();
    for (const { keyId, key } of parseCikSecret(cikSecret)) {
        const path = join(cikDir, `${keyId}.cik`);
        await Deno.writeFile(path, buildCikFile(keyId, key));
        cikPaths.set(keyId, path);
    }

    console.log(`Found ${unhandled.length} unhandled version(s). Fetching Crowdin strings...`);

    // Fetch Crowdin strings and project language map once at startup
    const [crowdinStrings, langMap] = await Promise.all([
        fetchAllCrowdinStrings(crowdin),
        fetchProjectLanguageMap(crowdin),
    ]);
    console.log(
        `Loaded ${crowdinStrings.size} strings from Crowdin, ${langMap.size} target languages.`,
    );

    let totalNewStrings = 0;
    const processedVersions: string[] = [];
    const skippedVersions: string[] = [];
    const warnings = new Map<string, number>();

    // Process each version sequentially, oldest-first
    for (const version of unhandled) {
        const entry = versionToEntry.get(version)!;
        console.log(`\nProcessing ${version} (${entry.channel})...`);

        // Release and Preview are encrypted with different keys; skip (and leave
        // unhandled) any package we cannot decrypt instead of failing the run.
        const keyId = await readPackageKeyId(entry.urls[0]);
        const cikPath = keyId ? cikPaths.get(keyId) : undefined;
        if (!cikPath) {
            console.warn(
                `  No CIK for key ${keyId ?? '<unknown>'} (${entry.channel}); skipping. ` +
                    'Add it to the XVC_CIK secret to include this channel.',
            );
            skippedVersions.push(`${version} (${entry.channel}, key ${keyId ?? 'unknown'})`);
            continue;
        }

        const packs = await extractLangFiles(entry, cikPath);

        if (packs.size === 0) {
            console.log(`  No lang files found - skipping.`);
        } else {
            for (const [packName, langs] of packs) {
                const enUS = langs.get('en_US');
                if (!enUS) {
                    console.log(`  Pack "${packName}": no en_US.lang - skipping.`);
                    continue;
                }

                let packNewStrings = 0;
                for (const [key, enValue] of enUS) {
                    if (crowdinStrings.has(key)) continue;
                    if (!enValue.trim()) continue; // Crowdin rejects empty source strings
                    console.log(`  New string: ${key} = "${enValue}"`);

                    // Gather translations from the other .lang files in this pack
                    const translations = new Map<string, string>();
                    for (const [langCode, langData] of langs) {
                        if (langCode === 'en_US') continue;

                        const translated = langData.get(key);
                        if (!translated) continue;

                        translations.set(langCode, translated);
                    }

                    const stringId = await uploadStringWithTranslations(
                        crowdin,
                        key,
                        enValue,
                        translations,
                        langMap,
                        warnings,
                    );
                    // Insert into local Map immediately- avoids re-querying Crowdin
                    crowdinStrings.set(key, { id: stringId, text: enValue });
                    packNewStrings++;
                    totalNewStrings++;
                }

                console.log(`  Pack "${packName}": ${packNewStrings} new string(s).`);
            }
        }

        // Persist progress after each version so a mid-run failure doesn't lose work
        handled.push(version);
        processedVersions.push(version);
        await Deno.writeTextFile(
            HANDLED_VERSIONS_PATH,
            JSON.stringify(handled, null, 2) + '\n',
        );
    }

    await Deno.remove(cikDir, { recursive: true }).catch(() => {});

    if (warnings.size > 0) {
        console.log('\nTranslation upload warnings:');
        for (const [reason, count] of warnings) console.log(`  ${count}x ${reason}`);
    }
    if (skippedVersions.length > 0) {
        console.log(`\nSkipped (no key): ${skippedVersions.join(', ')}`);
    }

    // Discord summary- only if new strings were found
    const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    if (totalNewStrings > 0 && discordWebhookUrl) {
        const versionList = processedVersions.map((v) => `\`${v}\``).join(', ');
        await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: '',
                embeds: [
                    {
                        title: '📦 Strings Added',
                        description:
                            'New strings have been added to the Universal Language Pack!',
                        url: '',
                        color: 3066993,
                        fields: [
                            {
                                name: 'Processed Versions',
                                value: versionList,
                                inline: true,
                            },
                            {
                                name: 'Strings Added',
                                value: totalNewStrings.toString(),
                                inline: true,
                            },
                        ],
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: 'Automated Check',
                            icon_url:
                                'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                        },
                    },
                ],
            }),
        });
    }

    console.log(
        `\nDone. ${totalNewStrings} new string(s) added across ${processedVersions.length} version(s).`,
    );
}

if (import.meta.main) {
    await main();
}
