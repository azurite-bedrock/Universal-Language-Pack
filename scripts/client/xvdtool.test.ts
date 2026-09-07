import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { buildCikFile, collectLangFiles, guidToBytes, parseCikSecret } from './xvdtool.ts';

const KEY_ID = '00112233-4455-6677-8899-aabbccddeeff';

Deno.test('guidToBytes matches .NET Guid.ToByteArray ordering', () => {
    assertEquals(
        Array.from(guidToBytes(KEY_ID)),
        // Data1..Data3 little-endian, Data4 as written
        [
            0x33, 0x22, 0x11, 0x00, 0x55, 0x44, 0x77, 0x66, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd,
            0xee, 0xff,
        ],
    );
});

Deno.test('parseCikSecret splits guid and decodes hex key', () => {
    const { keyId, key } = parseCikSecret(`${KEY_ID}:${'ab'.repeat(32)}`);
    assertEquals(keyId, KEY_ID);
    assertEquals(key.length, 32);
    assertEquals(key[0], 0xab);
});

Deno.test('parseCikSecret rejects malformed input', () => {
    assertThrows(() => parseCikSecret('nope'));
    assertThrows(() => parseCikSecret(`${KEY_ID}:abcd`));
});

Deno.test('buildCikFile lays out guid + 32-byte key into 0x30 bytes', () => {
    const key = new Uint8Array(32).fill(7);
    const file = buildCikFile(KEY_ID, key);
    assertEquals(file.length, 0x30);
    assertEquals(Array.from(file.subarray(0, 16)), Array.from(guidToBytes(KEY_ID)));
    assertEquals(Array.from(file.subarray(16)), Array.from(key));
});

Deno.test('collectLangFiles finds texts/*.lang under any resource pack', async () => {
    const root = await Deno.makeTempDir();
    try {
        const texts = `${root}/data/resource_packs/vanilla/texts`;
        await Deno.mkdir(texts, { recursive: true });
        await Deno.writeTextFile(`${texts}/en_US.lang`, 'a=b');
        await Deno.writeTextFile(`${texts}/languages.json`, '[]');
        await Deno.mkdir(`${root}/data/resource_packs/vanilla/textures`, { recursive: true });
        await Deno.writeTextFile(`${root}/data/resource_packs/vanilla/textures/x.lang`, 'no');

        const packs = await collectLangFiles(root);
        assertEquals([...packs.keys()], ['vanilla']);
        assertEquals([...packs.get('vanilla')!.keys()], ['en_US']);
        assertEquals(packs.get('vanilla')!.get('en_US'), 'a=b');
    } finally {
        await Deno.remove(root, { recursive: true });
    }
});

Deno.test(
    'collectLangFiles handles flat backslash filenames XvdTool writes on Linux',
    async () => {
        const root = await Deno.makeTempDir();
        try {
            // On Linux XvdTool does not split Windows paths into directories.
            await Deno.writeTextFile(
                `${root}/data\\resource_packs\\editor\\texts\\de_DE.lang`,
                'k=v',
            );
            await Deno.writeTextFile(
                `${root}/data\\resource_packs\\editor\\manifest.json`,
                '{}',
            );

            const packs = await collectLangFiles(root);
            assertEquals([...packs.keys()], ['editor']);
            assertEquals(packs.get('editor')!.get('de_DE'), 'k=v');
        } finally {
            await Deno.remove(root, { recursive: true });
        }
    },
);
