import { assertEquals } from 'jsr:@std/assert';
import { parsePackageVersion, selectPackage } from './discover.ts';

Deno.test('parsePackageVersion splits packed build/revision for releases', () => {
    assertEquals(
        parsePackageVersion('Microsoft.MinecraftUWP_1.26.4501.0_x64__8wekyb3d8bbwe.msixvc'),
        '1.26.45.1',
    );
});

Deno.test('parsePackageVersion handles three-digit builds for previews', () => {
    assertEquals(
        parsePackageVersion(
            'Microsoft.MinecraftWindowsBeta_1.21.12021.0_x64__8wekyb3d8bbwe.msixvc',
        ),
        '1.21.120.21',
    );
});

Deno.test('parsePackageVersion drops leading zeros in revision', () => {
    assertEquals(
        parsePackageVersion('Microsoft.MinecraftUWP_1.26.5002.0_x64__8wekyb3d8bbwe.msixvc'),
        '1.26.50.2',
    );
});

Deno.test('parsePackageVersion returns undefined for unrelated names', () => {
    assertEquals(parsePackageVersion('SegmentMetadata.bin'), undefined);
});

Deno.test('selectPackage picks the msixvc and expands every CDN root', () => {
    const pkg = selectPackage('release', {
        PackageFound: true,
        PackageFiles: [
            { FileName: 'foo.xsp', CdnRootPaths: ['http://a/'], RelativeUrl: 'x' },
            {
                FileName: 'Microsoft.MinecraftUWP_1.26.4501.0_x64__8wekyb3d8bbwe.msixvc',
                CdnRootPaths: ['http://assets1.xboxlive.com/', 'http://assets2.xboxlive.com/'],
                RelativeUrl:
                    'Z/abc/Microsoft.MinecraftUWP_1.26.4501.0_x64__8wekyb3d8bbwe.msixvc',
            },
        ],
    });
    assertEquals(pkg?.channel, 'release');
    assertEquals(pkg?.version, '1.26.45.1');
    assertEquals(pkg?.urls, [
        'http://assets1.xboxlive.com/Z/abc/Microsoft.MinecraftUWP_1.26.4501.0_x64__8wekyb3d8bbwe.msixvc',
        'http://assets2.xboxlive.com/Z/abc/Microsoft.MinecraftUWP_1.26.4501.0_x64__8wekyb3d8bbwe.msixvc',
    ]);
});

Deno.test('selectPackage returns undefined when no package was found', () => {
    assertEquals(
        selectPackage('preview', { PackageFound: false, PackageFiles: [] }),
        undefined,
    );
});
