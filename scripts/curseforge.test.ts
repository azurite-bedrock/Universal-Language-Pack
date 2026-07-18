import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { buildMetadata, type CFGameVersion, pickGameVersions } from './curseforge.ts';

const cfVersions: CFGameVersion[] = [
    { id: 1, name: '1.21.132' },
    { id: 2, name: '26.0' },
    { id: 4, name: '26.30' },
    { id: 3, name: '26.20' },
    { id: 5, name: '1.19' },
];

Deno.test('pickGameVersions sorts newest first', () => {
    const picked = pickGameVersions(cfVersions);
    assertEquals(
        picked.map((v) => v.name),
        ['26.30', '26.20', '26.0', '1.21.132', '1.19'],
    );
});

Deno.test('pickGameVersions caps the list at the limit', () => {
    const picked = pickGameVersions(cfVersions, 2);
    assertEquals(
        picked.map((v) => v.name),
        ['26.30', '26.20'],
    );
});

Deno.test('pickGameVersions defaults to at most 50 versions', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ id: i, name: `26.${i}` }));
    const picked = pickGameVersions(many);
    assertEquals(picked.length, 50);
    assertEquals(picked[0].name, '26.119');
});

Deno.test('pickGameVersions throws on an empty CurseForge version list', () => {
    assertThrows(() => pickGameVersions([]));
});

Deno.test('buildMetadata fills in tag and game versions', () => {
    const meta = buildMetadata('1.2.3', [4, 3]);
    assertEquals(meta.displayName, 'ULP-v1.2.3');
    assertEquals(meta.gameVersions, [4, 3]);
    assertEquals(meta.releaseType, 'release');
    assertEquals(meta.changelogType, 'markdown');
    assertEquals(meta.changelog.includes('/releases/tag/1.2.3'), true);
});
