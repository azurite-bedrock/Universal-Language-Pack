// Uploads the built .mcpack to CurseForge.
// Usage: VERSION=1.2.3 CURSEFORGE_API=<token> deno run -A scripts/release-curseforge.ts
// Set DRY_RUN=1 to resolve everything and print the metadata without uploading.

import { buildMetadata, type CFGameVersion, pickGameVersions } from './curseforge.ts';

const API_HOST = 'https://minecraft-bedrock.curseforge.com';
const PROJECT_ID = Deno.env.get('CURSEFORGE_PROJECT_ID') ?? '1536366';

function requireEnv(name: string): string {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`Missing required env var ${name}`);
    return value;
}

async function findMcpack(): Promise<string> {
    for await (const entry of Deno.readDir('build')) {
        if (entry.isFile && entry.name.endsWith('.mcpack')) return `build/${entry.name}`;
    }
    throw new Error('No .mcpack found in build/');
}

async function main(): Promise<void> {
    const token = requireEnv('CURSEFORGE_API');
    const version = requireEnv('VERSION');
    const packPath = await findMcpack();

    const versionsResp = await fetch(`${API_HOST}/api/game/versions`, {
        headers: { 'X-Api-Token': token },
    });
    if (!versionsResp.ok) {
        throw new Error(`Fetching game versions failed: HTTP ${versionsResp.status}`);
    }
    const cfVersions: CFGameVersion[] = await versionsResp.json();

    const gameVersions = pickGameVersions(cfVersions);
    const metadata = buildMetadata(
        version,
        gameVersions.map((v) => v.id),
    );

    console.log(`Uploading ${packPath} to project ${PROJECT_ID}`);
    console.log(
        `Game versions (${gameVersions.length}): ${gameVersions[0].name} … ${gameVersions.at(-1)!.name}`,
    );
    console.log(`Metadata: ${JSON.stringify(metadata)}`);

    if (Deno.env.get('DRY_RUN')) {
        console.log('DRY_RUN set - skipping upload.');
        return;
    }

    const form = new FormData();
    form.append('metadata', JSON.stringify(metadata));
    const file = await Deno.readFile(packPath);
    form.append('file', new Blob([file]), packPath.split('/').at(-1)!);

    const uploadResp = await fetch(`${API_HOST}/api/projects/${PROJECT_ID}/upload-file`, {
        method: 'POST',
        headers: { 'X-Api-Token': token },
        body: form,
    });
    const body = await uploadResp.text();
    if (!uploadResp.ok) {
        throw new Error(`Upload failed: HTTP ${uploadResp.status} ${body}`);
    }
    console.log(`Uploaded to CurseForge: ${body}`);

    const fileId = JSON.parse(body).id;
    const githubOutput = Deno.env.get('GITHUB_OUTPUT');
    if (githubOutput && fileId) {
        await Deno.writeTextFile(githubOutput, `file_id=${fileId}\n`, { append: true });
    }
}

if (import.meta.main) {
    await main();
}
