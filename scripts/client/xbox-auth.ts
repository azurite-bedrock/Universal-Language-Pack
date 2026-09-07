/**
 * Xbox Live authentication for the Windows GDK package discovery API.
 *
 * Flow (all plain fetch, no SDK):
 *   refresh token -> MSA access token -> XBL user token
 *                                      + dummy Win32 device token
 *                                     -> XSTS token for update.xboxlive.com
 *
 * Adapted from LukasPAH/minecraft-windows-gdk-version-db (getLatestVersion.ts)
 * and the dummy device token trick from @xboxreplay/xboxlive-auth.
 *
 * Run directly to obtain an initial refresh token interactively:
 *   deno run --allow-net scripts/client/xbox-auth.ts
 */

// Windows Store / Xbox app client that is allowed to talk to the update service.
export const CLIENT_ID = '00000000402b5328';
export const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';

const LIVE_AUTHORIZE_URL = 'https://login.live.com/oauth20_authorize.srf';
const LIVE_TOKEN_URL = 'https://login.live.com/oauth20_token.srf';
const USER_AUTHENTICATE_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const DEVICE_AUTHENTICATE_URL = 'https://device.auth.xboxlive.com/device/authenticate';
const XSTS_AUTHORIZE_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const UPDATE_RELYING_PARTY = 'http://update.xboxlive.com';

interface LiveTokenResponse {
    access_token: string;
    refresh_token: string;
}

export interface UpdateAuth {
    /** Value for the `Authorization` header on packagespc.xboxlive.com requests. */
    authorization: string;
    /** Rotated refresh token- persist this, the old one may stop working. */
    refreshToken: string;
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}) {
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-xbl-contract-version': '1',
            ...headers,
        },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        throw new Error(`${url} failed (${resp.status}): ${await resp.text()}`);
    }
    return (await resp.json()) as T;
}

async function liveToken(params: Record<string, string>): Promise<LiveTokenResponse> {
    const resp = await fetch(LIVE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE, ...params }).toString(),
    });
    if (!resp.ok) {
        throw new Error(`Live token request failed (${resp.status}): ${await resp.text()}`);
    }
    return (await resp.json()) as LiveTokenResponse;
}

/**
 * Build the login.live.com URL the user must open to authorize this client.
 */
export function getAuthorizeUrl(): string {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPE,
    });
    return `${LIVE_AUTHORIZE_URL}?${params}`;
}

/**
 * Extract the authorization `code` from the redirect URL the browser lands on.
 */
export function extractAuthCode(redirectedUrl: string): string | undefined {
    try {
        return new URL(redirectedUrl.trim()).searchParams.get('code') ?? undefined;
    } catch {
        return undefined;
    }
}

/**
 * A static, pre-signed "Win32 device" identity. The update service requires a
 * device token in the XSTS request, but does not validate the device itself.
 * (From @xboxreplay/xboxlive-auth `xnet.experimental.createDummyWin32DeviceToken`.)
 */
async function fetchDummyDeviceToken(): Promise<string> {
    const signature =
        'AAAAAQHcFbBVEuAAHfvqYcbt4rhMgxAKtPiOJgct4UTCX2HqbQNLTHsnwjp9zcYNZMKHEknpyGWNqsIhyXaAd2v8ADmGrfh11oMS1g==';
    const data = await postJson<{ Token: string }>(
        DEVICE_AUTHENTICATE_URL,
        {
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
            Properties: {
                AuthMethod: 'ProofOfPossession',
                Id: '91dc36cd-080a-4493-8234-3b585c78b0d5',
                DeviceType: 'Win32',
                Version: '10.0.19042',
                ProofKey: {
                    crv: 'P-256',
                    alg: 'ES256',
                    use: 'sig',
                    kty: 'EC',
                    x: 'qMKczrK1b5opLCIX-tzyqOWztlbERh1i5sxDzdHrdxs',
                    y: '23uwwgd2oSnWzyjHflRKaLxFsxX0-oE-mECf6c0gOaE',
                },
            },
        },
        { Signature: signature },
    );
    return data.Token;
}

/**
 * Turn a refresh token into an `Authorization` header for the update service.
 */
export async function authorizeForUpdateService(refreshToken: string): Promise<UpdateAuth> {
    const live = await liveToken({ grant_type: 'refresh_token', refresh_token: refreshToken });

    const [user, deviceToken] = await Promise.all([
        postJson<{ Token: string }>(USER_AUTHENTICATE_URL, {
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
            Properties: {
                AuthMethod: 'RPS',
                SiteName: 'user.auth.xboxlive.com',
                RpsTicket: live.access_token,
            },
        }),
        fetchDummyDeviceToken(),
    ]);

    const xsts = await postJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(
        XSTS_AUTHORIZE_URL,
        {
            RelyingParty: UPDATE_RELYING_PARTY,
            TokenType: 'JWT',
            Properties: {
                UserTokens: [user.Token],
                SandboxId: 'RETAIL',
                DeviceToken: deviceToken,
            },
        },
    );

    return {
        authorization: `XBL3.0 x=${xsts.DisplayClaims.xui[0].uhs};${xsts.Token}`,
        refreshToken: live.refresh_token,
    };
}

async function main(): Promise<void> {
    // The redirected URL may also be passed as the first argument for non-interactive use.
    let redirected: string | null = Deno.args[0] ?? null;
    if (!redirected) {
        console.log(
            'Open this URL in a browser, sign in, then paste the URL you were redirected to:\n',
        );
        console.log(getAuthorizeUrl() + '\n');
        redirected = prompt('Redirected URL:');
    }
    const code = redirected ? extractAuthCode(redirected) : undefined;
    if (!code) {
        console.error('No `code` parameter found in that URL.');
        Deno.exit(1);
    }

    const live = await liveToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
    });

    console.log('\nStore this as the XBOX_REFRESH_TOKEN secret:\n');
    console.log(live.refresh_token);
}

if (import.meta.main) {
    await main();
}
