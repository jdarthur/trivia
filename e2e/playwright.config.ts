import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { BASE_PORT, WORKERS, serverPort, workerBaseURL, workerDbPath } from './fixtures/servers';

const repoRoot = path.resolve(__dirname, '..');
const clientBuildDir = path.join(repoRoot, 'client', 'build');

// Same single-server topology as deployment (no proxy): build the client, then
// boot the Go API which serves the built client itself via static.go. We run in
// --dev-mode so the server skips the Auth0 JWKS fetch — which hard-fails offline
// and would otherwise make the harness depend on Auth0 reachability — and seeds
// the mock users the ?mockUser login needs. CLIENT_DIR points at the built client.
// --addr must be loopback: --dev-mode refuses to start on any other interface.
//
// One of these per worker, from port 8081 up (not the 8080 that `make run` uses,
// so a manually-running dev server never collides with the suite). Each gets its
// own scratch DB_PATH, distinct from the local prod trivia.db and removed before
// each run — see fixtures/servers.ts for why the databases are separate.
function apiServer(worker: number) {
  const port = serverPort(worker);
  const db = workerDbPath(worker);

  // Worker 0 builds the client; every other server waits for worker 0 to answer
  // before booting. serveClient() stats index.html once at startup and latches
  // into API-only mode when it is missing (static.go), so a server that starts
  // while `npm run build` is rewriting build/ would serve no client at all for
  // the whole run. Waiting on the port that only opens after the build is what
  // rules that out.
  //
  // `npm ci` only when there is nothing installed: CI always starts clean so it
  // still gets the locked install, while a local re-run skips ~9s of reinstall.
  const prelude =
    worker === 0
      ? 'cd client && (test -d node_modules || npm ci) && npm run build && cd ../server/go/src'
      : `until curl -sf http://127.0.0.1:${BASE_PORT}/ > /dev/null 2>&1; do sleep 0.5; done && cd server/go/src`;

  return {
    command:
      `${prelude} && rm -f ${db} ${db}-shm ${db}-wal && ` +
      `DB_PATH=${db} go run . --dev-mode --addr 127.0.0.1:${port}`,
    cwd: repoRoot,
    url: `http://localhost:${port}/`,
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      CLIENT_DIR: clientBuildDir,
      PORT: String(port),
    },
  };
}

export default defineConfig({
  testDir: './tests',
  workers: WORKERS,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: workerBaseURL(),
    trace: 'on-first-retry',
  },
  webServer: Array.from({ length: WORKERS }, (_, worker) => apiServer(worker)),
  projects: [
    // Chromium first; firefox/webkit are follow-up.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
