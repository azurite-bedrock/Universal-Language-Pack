/**
 * Wrapper around XvdTool.Streaming (https://github.com/LukeFZ/XvdTool.Streaming)
 * to stream-extract .lang files straight out of a remote .msixvc package.
 *
 * Requires the .NET 9 SDK (`dotnet` on PATH) and the package's content key
 * (CIK), which must be extracted from a device you own a licence on.
 */

import { unzipSync } from 'npm:fflate';
import { join } from 'jsr:@std/path';

/**
 * Upstream commit to build. The last tagged release (v1.2.1) predates the fix
 * for zero-length entries, which shifts every file after one by a page.
 */
export const XVDTOOL_COMMIT = 'b191811bfceef0f3da6652d587ae3c2eda16ff83';
const XVDTOOL_SOURCE_URL = `https://github.com/LukeFZ/XvdTool.Streaming/archive/${XVDTOOL_COMMIT}.zip`;

/** Where the tool is built into; safe to cache between CI runs. */
export const XVDTOOL_DIR = '.xvdtool';

const LANG_PATH_RE = /(?:^|[\\/])resource_packs[\\/]([^\\/]+)[\\/]texts[\\/]([^\\/]+)\.lang$/;

export interface Cik {
    keyId: string;
    key: Uint8Array;
}

/**
 * Parse the `XVC_CIK` secret: one or more "<key-id-guid>:<64 hex chars>" entries
 * separated by whitespace, commas or semicolons. Release and Preview are separate
 * products with separate content keys, so several are usually needed.
 */
export function parseCikSecret(secret: string): Cik[] {
    const entries = secret.split(/[\s,;]+/).filter(Boolean);
    if (entries.length === 0) throw new Error('XVC_CIK is empty');
    return entries.map((entry) => {
        const [keyId, hex] = entry.split(':');
        if (!keyId || !hex || !/^[0-9a-f-]{36}$/i.test(keyId) || !/^[0-9a-f]{64}$/i.test(hex)) {
            throw new Error('Each XVC_CIK entry must be "<key-id-guid>:<64 hex chars>"');
        }
        const key = new Uint8Array(32);
        for (let i = 0; i < 32; i++) key[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return { keyId: keyId.toLowerCase(), key };
    });
}

/**
 * Encode a GUID string the way .NET's `Guid.ToByteArray()` does:
 * first three groups little-endian, remaining bytes as written.
 */
export function guidToBytes(guid: string): Uint8Array {
    const hex = guid.replace(/-/g, '');
    if (hex.length !== 32) throw new Error(`Invalid GUID: ${guid}`);
    const raw = new Uint8Array(16);
    for (let i = 0; i < 16; i++) raw[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    return new Uint8Array([
        raw[3],
        raw[2],
        raw[1],
        raw[0],
        raw[5],
        raw[4],
        raw[7],
        raw[6],
        ...raw.subarray(8),
    ]);
}

/**
 * Build a 0x30-byte .cik file: GUID (16) + tweak key (16) + data key (16).
 * Layout matches XvdTool.Streaming's `KeyEntry`.
 */
export function buildCikFile(keyId: string, key: Uint8Array): Uint8Array {
    if (key.length !== 32) throw new Error('CIK key must be 32 bytes');
    const out = new Uint8Array(0x30);
    out.set(guidToBytes(keyId), 0);
    out.set(key, 0x10);
    return out;
}

/**
 * GET a URL as bytes, retrying on transient (5xx / network) failures.
 */
async function fetchWithRetry(url: string, attempts = 3): Promise<Uint8Array> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            const resp = await fetch(url);
            if (resp.ok) return new Uint8Array(await resp.arrayBuffer());
            lastError = new Error(`HTTP ${resp.status}`);
            if (resp.status < 500) break;
        } catch (e) {
            lastError = e;
        }
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
    throw new Error(`Failed to download ${url}: ${lastError}`);
}

/**
 * Build XvdTool.Streaming from source into XVDTOOL_DIR if not already present.
 * Needs the .NET 9 SDK. Returns the path to the entry DLL.
 */
export async function ensureXvdTool(): Promise<string> {
    const dll = join(XVDTOOL_DIR, 'XvdTool.Streaming.dll');
    const marker = join(XVDTOOL_DIR, '.commit');
    try {
        if ((await Deno.readTextFile(marker)).trim() === XVDTOOL_COMMIT) {
            await Deno.stat(dll);
            return dll;
        }
    } catch {
        // not built yet
    }

    console.log(`Building XvdTool.Streaming @ ${XVDTOOL_COMMIT.slice(0, 7)} ...`);
    const srcDir = await Deno.makeTempDir({ prefix: 'xvdtool-src-' });
    try {
        const files = unzipSync(await fetchWithRetry(XVDTOOL_SOURCE_URL));
        for (const [path, data] of Object.entries(files)) {
            if (path.endsWith('/')) continue;
            const target = join(srcDir, path);
            await Deno.mkdir(join(target, '..'), { recursive: true });
            await Deno.writeFile(target, data);
        }

        const project = join(
            srcDir,
            `XvdTool.Streaming-${XVDTOOL_COMMIT}`,
            'XvdTool.Streaming',
            'XvdTool.Streaming.csproj',
        );
        await Deno.remove(XVDTOOL_DIR, { recursive: true }).catch(() => {});
        const { code, stdout, stderr } = await new Deno.Command('dotnet', {
            args: [
                'publish',
                project,
                '-c',
                'Release',
                '-o',
                XVDTOOL_DIR,
                '--nologo',
                '-v',
                'q',
            ],
            env: { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' },
            stdout: 'piped',
            stderr: 'piped',
        }).output();
        if (code !== 0) {
            console.error(new TextDecoder().decode(stdout), new TextDecoder().decode(stderr));
            throw new Error(`dotnet publish failed (exit ${code})`);
        }
        await Deno.writeTextFile(marker, XVDTOOL_COMMIT + '\n');
        return dll;
    } finally {
        await Deno.remove(srcDir, { recursive: true }).catch(() => {});
    }
}

function xvdToolEnv(): Record<string, string> {
    return {
        DOTNET_ROLL_FORWARD: 'Major',
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
        NO_COLOR: '1',
        TERM: 'dumb',
    };
}

/**
 * Read the content key ID a remote package is encrypted with. Only the XVC
 * header is fetched, so this is cheap- use it to skip packages we have no key
 * for before streaming gigabytes.
 */
export async function readPackageKeyId(url: string): Promise<string | undefined> {
    const dll = await ensureXvdTool();
    const { stdout } = await new Deno.Command('dotnet', {
        args: [dll, 'info', url],
        env: xvdToolEnv(),
        stdout: 'piped',
        stderr: 'piped',
    }).output();
    const text = new TextDecoder().decode(stdout);
    return text.match(/Encryption Key 0 GUID:\s*([0-9a-f-]{36})/i)?.[1]?.toLowerCase();
}

/**
 * Stream-extract a remote .msixvc into `outputDir` using the given CIK.
 * Hash verification is skipped- the CDN is trusted and it halves the runtime.
 */
export async function extractPackage(
    url: string,
    cikPath: string,
    outputDir: string,
): Promise<void> {
    const dll = await ensureXvdTool();
    console.log(`  Extracting ${url} ...`);
    const cmd = new Deno.Command('dotnet', {
        args: [dll, 'extract', url, '-c', cikPath, '-o', outputDir, '--no-hash-check'],
        env: xvdToolEnv(),
        stdout: 'piped',
        stderr: 'piped',
    });
    const { code, stdout, stderr } = await cmd.output();
    const out = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    // The tool prints a progress bar; keep only informative lines.
    const lines = out.split('\n').filter((l) => /INFO|WARN|ERR|error/i.test(l));
    for (const line of lines) console.log('  ' + line.trim());
    if (code !== 0 || /Successfully/.test(out) === false) {
        throw new Error(`XvdTool extract failed (exit ${code})`);
    }
}

/**
 * Walk an extracted package and read every resource_packs/<pack>/texts/<lang>.lang.
 * Returns Map<packName, Map<langCode, fileContent>>.
 */
export async function collectLangFiles(
    rootDir: string,
): Promise<Map<string, Map<string, string>>> {
    const packs = new Map<string, Map<string, string>>();

    async function walk(dir: string): Promise<void> {
        for await (const entry of Deno.readDir(dir)) {
            const path = join(dir, entry.name);
            if (entry.isDirectory) {
                await walk(path);
                continue;
            }
            const match = path.match(LANG_PATH_RE);
            if (!match) continue;
            const [, packName, langCode] = match;
            if (!packs.has(packName)) packs.set(packName, new Map());
            packs.get(packName)!.set(langCode, await Deno.readTextFile(path));
        }
    }

    await walk(rootDir);
    return packs;
}
