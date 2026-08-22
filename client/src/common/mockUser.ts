// Dev-mode mock identity. A `?mockUser=<name>` URL param logs the editor in as
// a seeded dev-mode user against a --dev-mode backend, bypassing Auth0. The
// client embeds the sub (`dev|<name>`) and a future exp in an UNSIGNED JWT; the
// server only accepts such tokens when running with --dev-mode, so this path is
// inert against a production backend.

export const MOCK_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%2355acee'/%3E%3Ctext x='20' y='27' font-size='18' text-anchor='middle' fill='white' font-family='sans-serif'%3E?%3C/text%3E%3C/svg%3E";

export function getMockUserName(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get("mockUser");
}

export function isMockMode(): boolean {
    return !!getMockUserName();
}

// base64url-encode a string (RFC 4648 §5), the form JWT segments use.
function b64url(str: string): string {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// buildMockToken makes an unsigned (alg "none") JWT carrying the dev-mode sub
// and a future exp. The trailing signature segment is empty for "none".
export function buildMockToken(name: string): string {
    const header = b64url(JSON.stringify({alg: "none", typ: "JWT"}));
    const payload = b64url(JSON.stringify({
        sub: `dev|${name}`,
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
    }));
    return `${header}.${payload}.`;
}
