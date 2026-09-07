/**
 * Discover the latest Minecraft Windows (GDK) client packages via the Xbox
 * update service. Adapted from LukasPAH/minecraft-windows-gdk-version-db.
 *
 * The service only ever reports the *current* package per channel, so this
 * yields at most one release + one preview version per run.
 */

import type { UpdateAuth } from './xbox-auth.ts';

const PACKAGE_API = 'https://packagespc.xboxlive.com/GetBasePackage';

export const CHANNELS = {
    release: '7792d9ce-355a-493c-afbd-768f4a77c3b0',
    preview: '98bd2335-9b01-4e4c-bd05-ccc01614078b',
} as const;

export type Channel = keyof typeof CHANNELS;

export interface ClientPackage {
    channel: Channel;
    /** Normalised version, e.g. "1.26.45.1". Matches the BDS-style entries in handled-versions.json. */
    version: string;
    /** Raw package file name, e.g. "Microsoft.MinecraftUWP_1.26.4501.0_x64__8wekyb3d8bbwe.msixvc". */
    fileName: string;
    /** Mirror URLs (assets1/assets2.xboxlive.com); any of them works. */
    urls: string[];
}

interface PackageFile {
    FileName: string;
    CdnRootPaths: string[];
    RelativeUrl: string;
}

interface UpdateResponse {
    PackageFound: boolean;
    PackageFiles: PackageFile[];
}

const PACKAGE_VERSION_RE = /_(\d+)\.(\d+)\.(\d+)\.\d+_/;

/**
 * Convert a package file name to the 4-part version used throughout this repo.
 *
 * The store encodes build+revision into one number: "1.26.4501.0" is
 * 1.26 build 45 revision 01, i.e. "1.26.45.1". Preview "1.21.12021.0"
 * becomes "1.21.120.21".
 */
export function parsePackageVersion(fileName: string): string | undefined {
    const match = fileName.match(PACKAGE_VERSION_RE);
    if (!match) return undefined;
    const [, major, minor, packed] = match;
    const packedNum = Number(packed);
    const build = Math.floor(packedNum / 100);
    const revision = packedNum % 100;
    return `${Number(major)}.${Number(minor)}.${build}.${revision}`;
}

/**
 * Pick the .msixvc entry out of an update response and build its mirror URLs.
 */
export function selectPackage(
    channel: Channel,
    data: UpdateResponse,
): ClientPackage | undefined {
    if (!data.PackageFound) return undefined;
    const file = data.PackageFiles.find((f) => f.FileName.endsWith('.msixvc'));
    if (!file) return undefined;
    const version = parsePackageVersion(file.FileName);
    if (!version) return undefined;
    return {
        channel,
        version,
        fileName: file.FileName,
        urls: file.CdnRootPaths.map((root) => root + file.RelativeUrl),
    };
}

/**
 * Query the update service for the current package of one channel.
 */
export async function fetchLatestPackage(
    channel: Channel,
    auth: UpdateAuth,
): Promise<ClientPackage | undefined> {
    const resp = await fetch(`${PACKAGE_API}/${CHANNELS[channel]}`, {
        headers: { Authorization: auth.authorization },
    });
    if (!resp.ok) {
        throw new Error(
            `GetBasePackage(${channel}) failed (${resp.status}): ${await resp.text()}`,
        );
    }
    return selectPackage(channel, (await resp.json()) as UpdateResponse);
}

/**
 * Fetch the current release and preview packages.
 */
export async function discoverClientPackages(auth: UpdateAuth): Promise<ClientPackage[]> {
    const results = await Promise.all(
        (Object.keys(CHANNELS) as Channel[]).map((c) => fetchLatestPackage(c, auth)),
    );
    return results.filter((p): p is ClientPackage => p !== undefined);
}
