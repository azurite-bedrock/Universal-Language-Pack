import { assertEquals } from 'jsr:@std/assert';
import { buildUpsideDownLocale, flipString, type LocaleEntry } from './upside-down.ts';

Deno.test('flipString flips and reverses plain text', () => {
    assertEquals(flipString('Hello'), 'oꞁꞁǝH');
});

Deno.test('flipString flips punctuation to inverted forms', () => {
    assertEquals(flipString('What?'), '¿ʇɐɥM');
    assertEquals(flipString('Done!'), '¡ǝuoᗡ');
    assertEquals(flipString("don't."), '˙ʇ,uop');
});

Deno.test('flipString mirrors paired brackets', () => {
    assertEquals(flipString('(ok)'), '(ʞo)');
});

Deno.test('flipString keeps a single placeholder intact', () => {
    assertEquals(flipString('Press the %s to go back'), 'ʞɔɐq oᵷ oʇ %s ǝɥʇ ssǝɹԀ');
});

Deno.test('flipString renumbers multiple unnumbered placeholders', () => {
    assertEquals(flipString('%s says %s'), '%2$s sʎɐs %1$s');
});

Deno.test('flipString keeps already numbered placeholders unchanged', () => {
    assertEquals(flipString('%1$s and %2$s'), '%2$s puɐ %1$s');
});

Deno.test('flipString keeps literal %% intact', () => {
    assertEquals(flipString('+%d%% boost'), 'ʇsooq %%%d+');
});

Deno.test('flipString keeps § codes before the text they style', () => {
    assertEquals(flipString('§7Hidden text'), '§7ʇxǝʇ uǝppᴉH');
    assertEquals(flipString('up to §d%d§r friends'), ' oʇ dn§d%d§rspuǝᴉɹɟ ');
});

Deno.test('flipString leaves digits as they are', () => {
    assertEquals(flipString('100+'), '+001');
});

function entry(identifier: string, translation: string): LocaleEntry {
    return {
        identifier,
        source_string: translation,
        translation,
        context: null,
        labels: 'lang, unassigned',
        max_length: null,
    };
}

Deno.test('buildUpsideDownLocale flips regular strings', () => {
    const [e] = buildUpsideDownLocale([entry('item.apple.name', 'Apple')]);
    assertEquals(e.translation, 'ǝꞁddⱯ');
});

Deno.test('buildUpsideDownLocale keeps TTS and accessibility strings readable', () => {
    const out = buildUpsideDownLocale([
        entry('accessibility.chat.tts.keyboard', 'Keyboard'),
        entry('chat.settings.tts', 'Text To Speech For Chat'),
    ]);
    assertEquals(out[0].translation, 'Keyboard');
    assertEquals(out[1].translation, 'Text To Speech For Chat');
});

Deno.test('buildUpsideDownLocale keeps pack metadata readable', () => {
    const out = buildUpsideDownLocale([
        entry('pack.name', 'Universal Language Pack'),
        entry('pack.description', 'Translations!'),
    ]);
    assertEquals(out[0].translation, 'Universal Language Pack');
    assertEquals(out[1].translation, 'Translations!');
});

Deno.test('buildUpsideDownLocale names the language English (Upside Down)', () => {
    const [e] = buildUpsideDownLocale([entry('language.name', 'English (United States)')]);
    assertEquals(e.translation, 'English (Upside Down)');
});
