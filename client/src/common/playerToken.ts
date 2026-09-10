// The per-player bearer credential (ticket #256). It is a capability, not an
// identity: player_id is a public identifier that appears in URLs and every
// roster/scoreboard read, while this token proves the caller is the browser
// that created the player. It lives in sessionStorage (never the URL) and is
// sent in the borttrivia-player-token header on every gameplay request.
const PLAYER_TOKEN = "player_token"

export function getPlayerToken(): string {
    return sessionStorage.getItem(PLAYER_TOKEN) || ""
}

export function setPlayerToken(token: string): void {
    sessionStorage.setItem(PLAYER_TOKEN, token)
}

export function clearPlayerToken(): void {
    sessionStorage.removeItem(PLAYER_TOKEN)
}
