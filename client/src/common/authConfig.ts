// Single source of truth for the Auth0 API audience and scope.
//
// These must match on the Auth0Provider and on every getAccessTokenSilently
// call: the SDK caches tokens keyed by (audience, scope), so a mismatch turns
// what should be a cache hit into a fresh network round-trip.
//
// `offline_access` is what makes Auth0 issue a refresh token. It also requires
// two tenant-side settings, or it is silently dropped:
//   - the SPA application must have Refresh Token Rotation enabled
//   - the API must have "Allow Offline Access" enabled
export const AUDIENCE = "https://borttrivia.com/editor";
export const SCOPE = "openid profile email offline_access";
