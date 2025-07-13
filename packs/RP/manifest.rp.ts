// Function to get git tag version
async function getGitVersion() {
    try {
        // Get the latest git tag
        const command = new Deno.Command('git', {
            args: ['describe', '--tags', '--match', '[0-9]*', '--abbrev=0'],
            stdout: 'piped',
            stderr: 'piped',
        });

        const { code, stdout } = await command.output();

        if (code !== 0) {
            console.warn('Could not get git tag, using default version [1, 0, 0]');
            return [1, 0, 0];
        }

        const gitTag = new TextDecoder().decode(stdout).trim();
        return parseVersion(gitTag);
    } catch (error) {
        if (error instanceof Error) console.warn('Error getting git version:', error.message);
        else console.warn('Error getting git version:', error);
        return [1, 0, 0];
    }
}

// Function to parse version string to array format
function parseVersion(versionString: string) {
    // Remove 'v' prefix if present
    const cleanVersion = versionString.replace(/^v/, '');

    // Split by dots and convert to numbers
    const parts = cleanVersion.split('.').map((part) => parseInt(part, 10));

    // Ensure we have exactly 3 parts, pad with 0 if needed
    while (parts.length < 3) {
        parts.push(0);
    }

    // Only take first 3 parts in case there are more (like 1.0.0-beta)
    return parts.slice(0, 3);
}

// Get the version
const version = await getGitVersion();
console.log(`Using version: [${version.join(', ')}]`);

const manifest = {
    format_version: 2,
    header: {
        name: 'pack.name',
        description: 'pack.description',
        uuid: '64eb694b-5e34-4627-861e-a2289fa70934',
        version: version,
        min_engine_version: [1, 13, 0],
    },
    modules: [
        {
            type: 'resources',
            uuid: 'eab7bf7b-7c0b-4fdf-af77-a69eda53fcbb',
            version: version,
        },
    ],
};

Deno.writeTextFileSync('manifest.json', JSON.stringify(manifest));
