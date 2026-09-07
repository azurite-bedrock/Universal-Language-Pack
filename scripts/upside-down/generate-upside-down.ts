// Regenerates locales/en_UD.json from locales/en_US.json.
// Usage: deno run --allow-read --allow-write scripts/generate-upside-down.ts

import { buildUpsideDownLocale, type LocaleEntry } from './upside-down.ts';

const SOURCE_PATH = 'locales/en_US.json';
const TARGET_PATH = 'locales/en_UD.json';

async function main(): Promise<void> {
    const enUS: LocaleEntry[] = JSON.parse(await Deno.readTextFile(SOURCE_PATH));
    const enUD = buildUpsideDownLocale(enUS);
    await Deno.writeTextFile(TARGET_PATH, JSON.stringify(enUD, null, 4));
    console.log(`Wrote ${TARGET_PATH} (${enUD.length} strings from ${SOURCE_PATH})`);
}

if (import.meta.main) {
    await main();
}
