export interface CFGameVersion {
    id: number;
    name: string;
}

export interface CFUploadMetadata {
    changelog: string;
    changelogType: 'markdown';
    displayName: string;
    gameVersions: number[];
    releaseType: 'release';
}

function byNumericVersionDesc(a: CFGameVersion, b: CFGameVersion): number {
    const pa = a.name.split('.').map(Number);
    const pb = b.name.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * The pack supports every game version, so an upload is tagged with all of
 * them, newest first, capped to keep the list manageable. CurseForge's new
 * naming scheme ("26.30") sorts above the old one ("1.21.132") numerically,
 * which matches release chronology.
 */
export function pickGameVersions(cfVersions: CFGameVersion[], limit = 50): CFGameVersion[] {
    if (cfVersions.length === 0) throw new Error('CurseForge returned no game versions');
    return [...cfVersions].sort(byNumericVersionDesc).slice(0, limit);
}

export function buildMetadata(tag: string, gameVersionIds: number[]): CFUploadMetadata {
    return {
        changelog:
            `Weekly automated release. Details: ` +
            `https://github.com/azurite-bedrock/Universal-Language-Pack/releases/tag/${tag}`,
        changelogType: 'markdown',
        displayName: `ULP-v${tag}`,
        gameVersions: gameVersionIds,
        releaseType: 'release',
    };
}
