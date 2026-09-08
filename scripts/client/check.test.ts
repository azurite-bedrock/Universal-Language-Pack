import { assertEquals, assertThrows } from 'jsr:@std/assert';
import {
    assertDecrypted,
    computeUnhandled,
    mapWithConcurrency,
    normalizeLangCode,
    parseLangFile,
    sortVersionsOldestFirst,
} from './check.ts';

Deno.test('parseLangFile skips comment lines', () => {
    const result = parseLangFile('# comment\naccessibility.foo=Bar');
    assertEquals(result.get('accessibility.foo'), 'Bar');
    assertEquals(result.size, 1);
});

Deno.test('parseLangFile skips blank lines', () => {
    const result = parseLangFile('\naccessibility.foo=Bar\n\n');
    assertEquals(result.size, 1);
});

Deno.test('parseLangFile preserves = characters in values', () => {
    const result = parseLangFile('key=value=with=equals');
    assertEquals(result.get('key'), 'value=with=equals');
});

Deno.test('parseLangFile strips inline ## comments from values', () => {
    const result = parseLangFile('comment.like=%d like                    ## 1 like');
    assertEquals(result.get('comment.like'), '%d like');
});

Deno.test('parseLangFile handles value with no inline comment unchanged', () => {
    const result = parseLangFile('key=normal value');
    assertEquals(result.get('key'), 'normal value');
});

Deno.test('sortVersionsOldestFirst orders by numeric components', () => {
    const result = sortVersionsOldestFirst(['1.20.0.1', '1.10.0.7', '1.9.0.15']);
    assertEquals(result, ['1.9.0.15', '1.10.0.7', '1.20.0.1']);
});

Deno.test('sortVersionsOldestFirst handles large patch numbers', () => {
    const result = sortVersionsOldestFirst(['1.20.30.26', '1.20.0.1']);
    assertEquals(result, ['1.20.0.1', '1.20.30.26']);
});

Deno.test('normalizeLangCode replaces underscore with hyphen', () => {
    assertEquals(normalizeLangCode('de_DE'), 'de-DE');
    assertEquals(normalizeLangCode('zh_CN'), 'zh-CN');
    assertEquals(normalizeLangCode('en_US'), 'en-US');
});

Deno.test('normalizeLangCode replaces ALL underscores for script-subtag locales', () => {
    assertEquals(normalizeLangCode('zh_Hant_TW'), 'zh-Hant-TW');
    assertEquals(normalizeLangCode('sr_Latn_RS'), 'sr-Latn-RS');
});

Deno.test('computeUnhandled returns versions not in handled set', () => {
    const result = computeUnhandled(['1.10.0.7', '1.11.0.23', '1.13.0.34'], ['1.10.0.7']);
    assertEquals(result, ['1.11.0.23', '1.13.0.34']);
});

Deno.test('computeUnhandled returns all when handled is empty', () => {
    const result = computeUnhandled(['1.10.0.7', '1.11.0.23'], []);
    assertEquals(result, ['1.10.0.7', '1.11.0.23']);
});

Deno.test('computeUnhandled returns empty when all are handled', () => {
    const result = computeUnhandled(['1.10.0.7'], ['1.10.0.7']);
    assertEquals(result, []);
});

Deno.test('assertDecrypted accepts readable vanilla en_US', () => {
    assertDecrypted(new Map([['vanilla', new Map([['en_US', 'menu.play=Play\n']])]]));
});

Deno.test('assertDecrypted rejects missing en_US', () => {
    assertThrows(() => assertDecrypted(new Map()));
});

Deno.test('assertDecrypted rejects ciphertext-looking content', () => {
    assertThrows(() =>
        assertDecrypted(new Map([['vanilla', new Map([['en_US', 'a=b\0\x7f']])]])),
    );
    assertThrows(() =>
        assertDecrypted(new Map([['vanilla', new Map([['en_US', 'no equals here']])]])),
    );
});

Deno.test('mapWithConcurrency processes every item and caps parallelism', async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        seen.push(n);
        inFlight--;
    });
    assertEquals(
        seen.sort((a, b) => a - b),
        [1, 2, 3, 4, 5, 6, 7],
    );
    assertEquals(peak, 3);
});

Deno.test('mapWithConcurrency handles an empty list', async () => {
    await mapWithConcurrency([], 4, () => Promise.resolve());
});
