import { unzipSync } from 'npm:fflate';
import CrowdinApi from 'npm:@crowdin/crowdin-api-client';

type CrowdinClient = InstanceType<typeof CrowdinApi.default>;

const PROJECT_ID = 775034;

const HANDLED_VERSIONS_PATH = 'handled-versions.json';

const BDS_VERSIONS_URL =
    'https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json';
const LANG_PATH_RE = /^resource_packs\/(vanilla|editor|chemistry)\/texts\/(.+\.lang)$/;

interface BdsVersionEntry {
    version: string;
    platform: 'linux' | 'linux_preview';
}

/**
 * Parse a Minecraft .lang file into a key->value Map.
 * Skips comment lines (starting with #) and blank lines.
 * Strips inline ## comments from values and trims trailing whitespace.
 */
export function parseLangFile(content: string): Map<string, string> {
    const result = new Map<string, string>();
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const raw = trimmed.substring(eqIdx + 1);
        const commentIdx = raw.indexOf('##');
        const value = (commentIdx !== -1 ? raw.substring(0, commentIdx) : raw).trimEnd();
        result.set(trimmed.substring(0, eqIdx), value);
    }
    return result;
}

/**
 * Sort BDS version strings oldest-first using numeric component comparison.
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
 * Normalize a BDS locale code to Crowdin language ID format.
 * e.g. "de_DE" -> "de-DE"
 */
export function normalizeLangCode(bdsCode: string): string {
    return bdsCode.replace(/_/g, '-');
}

/**
 * Return versions from `all` that are not present in `handled`.
 */
export function computeUnhandled(all: string[], handled: string[]): string[] {
    const handledSet = new Set(handled);
    return all.filter((v) => !handledSet.has(v));
}

/**
 * Fetch the BDS version list from Bedrock-OSS/BDS-Versions.
 * Returns the union of linux + linux_preview versions, deduplicated.
 * linux takes precedence when a version appears in both lists.
 */
export async function fetchBdsVersionList(): Promise<BdsVersionEntry[]> {
    const resp = await fetch(BDS_VERSIONS_URL);
    if (!resp.ok) throw new Error(`Failed to fetch BDS versions: ${resp.status}`);
    const data = await resp.json();

    const seen = new Set<string>();
    const result: BdsVersionEntry[] = [];

    for (const v of (data.linux?.versions ?? []) as string[]) {
        if (!seen.has(v)) {
            seen.add(v);
            result.push({ version: v, platform: 'linux' });
        }
    }
    for (const v of (data.linux_preview?.versions ?? []) as string[]) {
        if (!seen.has(v)) {
            seen.add(v);
            result.push({ version: v, platform: 'linux_preview' });
        }
    }

    return result;
}

/**
 * Fetch the download URL for a specific BDS version
 * from the per-version JSON in Bedrock-OSS/BDS-Versions.
 */
export async function fetchVersionDownloadUrl(entry: BdsVersionEntry): Promise<string> {
    const url = `https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/${entry.platform}/${entry.version}.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(`Failed to fetch version info for ${entry.version}: ${resp.status}`);
    }
    const data = await resp.json();
    return data.download_url as string;
}

/**
 * Download a BDS server zip from a URL and return it as a Uint8Array.
 */
async function downloadZip(url: string): Promise<Uint8Array> {
    console.log(`  Downloading ${url} ...`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Download failed (${resp.status}): ${url}`);
    return new Uint8Array(await resp.arrayBuffer());
}

/**
 * Extract all .lang files from a BDS server zip.
 * Only reads resource_packs/{vanilla,editor,chemistry}/texts/*.lang entries.
 * Pack directories not present in the zip are silently absent from the result.
 *
 * Returns: Map<packName, Map<langCode, Map<key, value>>>
 * e.g. "vanilla" -> "de_DE" -> "accessibility.foo" -> "Barrierefreiheit"
 */
export function extractLangFiles(
    zipData: Uint8Array,
): Map<string, Map<string, Map<string, string>>> {
    const files = unzipSync(zipData, {
        filter: (file) => LANG_PATH_RE.test(file.name),
    });

    const packs = new Map<string, Map<string, Map<string, string>>>();

    for (const [path, data] of Object.entries(files)) {
        const match = path.match(LANG_PATH_RE);
        if (!match) continue;
        const packName = match[1];
        const langCode = match[2].replace('.lang', '');
        const content = new TextDecoder().decode(data);

        if (!packs.has(packName)) packs.set(packName, new Map());
        packs.get(packName)!.set(langCode, parseLangFile(content));
    }

    return packs;
}

/**
 * Fetch the Crowdin language map for this project.
 * Returns Map<bdsLocaleCode, crowdinLanguageId>
 * e.g. "de_DE" -> "de", "zh_TW" -> "zh-TW", "pt_BR" -> "pt-BR"
 * Uses the project's own targetLanguages list — the only reliable source of truth.
 */
async function fetchProjectLanguageMap(crowdin: CrowdinClient): Promise<Map<string, string>> {
    const project = await crowdin.projectsGroupsApi.getProject(PROJECT_ID);
    const map = new Map<string, string>();
    for (const lang of project.data.targetLanguages) {
        // lang.locale = "de-DE", lang.id = "de"
        const bdsCode = lang.locale.replace(/-/g, '_');
        map.set(bdsCode, lang.id);
    }
    return map;
}

/**
 * Fetch ALL source strings from the Crowdin project (paginated, 500 per page).
 * Returns Map<identifier, { id, text }>.
 * Called once at startup- never again during a run- to avoid hammering the
 * API across 80k+ strings.
 */
async function fetchAllCrowdinStrings(
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

/**
 * Upload a new source string to Crowdin and immediately upload
 * all available vanilla translations for it.
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
    translations: Map<string, string>, // BDS locale code (de_DE) -> translated text
    langMap: Map<string, string>, // BDS locale code -> Crowdin language ID
): Promise<number> {
    const addResp = await crowdin.sourceStringsApi.addString(PROJECT_ID, {
        identifier,
        text: enValue,
        branchId: 5, // main
    });
    const stringId = addResp.data.id;

    for (const [bdsCode, text] of translations) {
        const crowdinLang = langMap.get(bdsCode);
        if (!crowdinLang) continue; // language not configured in this project
        try {
            await crowdin.stringTranslationsApi.addTranslation(PROJECT_ID, {
                stringId,
                languageId: crowdinLang,
                text,
            });
        } catch (e) {
            console.warn(
                `  Warning: could not upload translation ${bdsCode}/${identifier}: ${e}`,
            );
        }
    }

    return stringId;
}

async function main(): Promise<void> {
    const crowdin = new CrowdinApi.default({ token: Deno.env.get('CROWDIN_API')! });

    // Fetch BDS version list (linux + linux_preview, deduped)
    console.log('Fetching BDS version list...');
    const allEntries = await fetchBdsVersionList();
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
        console.log('No new BDS versions to process. Exiting.');
        return;
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

    // Process each version sequentially, oldest-first
    for (const version of unhandled) {
        const entry = versionToEntry.get(version)!;
        console.log(`\nProcessing ${version} (${entry.platform})...`);

        const downloadUrl = await fetchVersionDownloadUrl(entry);
        const zipData = await downloadZip(downloadUrl);
        const packs = extractLangFiles(zipData);

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
                    if (crowdinStrings.has(key.trim())) continue;
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

    // 6. Discord summary- only if new strings were found
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
                        thumbnail: {
                            url: 'https://github.com/azurite-bedrock/media-kit/blob/main/logo/azurite.png?raw=true',
                        },
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
