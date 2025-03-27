const LOCALES_PATH = '../../../../locales/';
const LANG_KEY = 'language.name';

const langFiles: Deno.DirEntry[] = Array.from(Deno.readDirSync(LOCALES_PATH));

const langNames: [string, string][] = [['en_US', 'English (United States)']];

for (const langFile of langFiles) {
    const langName = langFile.name.split('.')[0];

    const langData: {
        identifier: string;
        source_string: string;
        translation: string;
        context: null;
        labels: string;
        max_length: null;
    }[] = JSON.parse(Deno.readTextFileSync(`${LOCALES_PATH}${langFile.name}`));

    const displayName =
        langData.find((entry) => entry.identifier === LANG_KEY)?.translation || langName;

    if (langName !== 'en_US') {
        langNames.push([langName, displayName]);
    }

    Deno.writeTextFileSync(
        `${langName}.lang`,
        langData.map((lang) => `${lang.identifier}=${lang.translation}`).join('\n'),
        { append: true }
    );
}

Deno.writeTextFileSync('languages.json', JSON.stringify(langNames.map(([name, _]) => name)));
Deno.writeTextFileSync('language_names.json', JSON.stringify(langNames));
