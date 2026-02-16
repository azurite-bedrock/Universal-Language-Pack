// Function to get git tag version
async function getGitVersion() {
    try {
        // Get all tags, filter for semver, and sort
        const command = new Deno.Command('git', {
            args: ['tag'],
            stdout: 'piped',
            stderr: 'piped',
        });

        const { code, stdout } = await command.output();
        
        if (code !== 0) {
            console.warn('Could not get git tags, using default version 0.1.0');
            return [0, 1, 0];
        }
        
        const allTags = new TextDecoder().decode(stdout).trim().split('\n');
        
        // Filter for semver tags and sort
        const semverTags = allTags
            .filter(tag => /^v?\d+\.\d+\.\d+$/.test(tag))
            .sort((a, b) => {
                const aParts = parseVersion(a);
                const bParts = parseVersion(b);
                for (let i = 0; i < 3; i++) {
                    if (aParts[i] !== bParts[i]) {
                        return aParts[i] - bParts[i];
                    }
                }
                return 0;
            });
        
        if (semverTags.length === 0) {
            console.warn('No semver tags found, using default version [1, 0, 0]');
            return [1, 0, 0];
        }
        
        const latestTag = semverTags[semverTags.length - 1];
        console.log(`Found latest tag: ${latestTag}`);
        return parseVersion(latestTag);
    } catch (error) {
        if (error instanceof Error) console.warn('Error getting git version:', error.message);
        else console.warn('Error getting git version:', error);
        return [1, 0, 0];
    }
}

// Function to parse version string to array format
function parseVersion(versionString: string): number[] {
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
console.log(`Using version ${version.join('.')}`);

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

Deno.writeTextFileSync('manifest.json', JSON.stringify(manifest, null, 2));