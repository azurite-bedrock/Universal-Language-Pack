import { join } from 'jsr:@std/path@^1';

const LOCALES_PATH = join(Deno.env.get('ROOT_DIR')!, 'locales');
const LANG_NAME_KEY = 'language.name';

const langFiles: Deno.DirEntry[] = Array.from(Deno.readDirSync(LOCALES_PATH));
const langNames: [string, string][] = [['en_US', 'English (United States)']];

for (const langFile of langFiles) {
    const langName = langFile.name.split('.')[0];

    const langData: {
        identifier: string;
        source_string: string;
        translation: string | null;
        context: string | null;
        labels: string;
        max_length: number | null;
    }[] = JSON.parse(Deno.readTextFileSync(join(LOCALES_PATH, langFile.name)));

    const displayName =
        langData.find((entry) => entry.identifier === LANG_NAME_KEY)?.translation || langName;

    if (langName !== 'en_US') {
        langNames.push([langName, displayName]);
    }

    Deno.writeTextFileSync(
        `${langName}.lang`,
        langData
            .sort((a, b) => a.identifier.localeCompare(b.identifier))
            .map((lang) => `${lang.identifier}=${lang.translation}`)
            .join('\n'),
        { append: true },
    );
}

Deno.writeTextFileSync(
    'languages.json',
    JSON.stringify(langNames.sort((a, b) => a[0].localeCompare(b[0])).map(([name, _]) => name)),
);
Deno.writeTextFileSync(
    'language_names.json',
    JSON.stringify(langNames.sort((a, b) => a[0].localeCompare(b[0]))),
);
