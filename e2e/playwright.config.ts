import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const clientBuildDir = path.join(repoRoot, 'client', 'build');

export default defineConfig({
  testDir: './tests',
  // The API holds one SQLite DB shared by all workers, so the suite must run
  // serially. Per-worker DB files to enable parallel workers is follow-up work.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080/',
    trace: 'on-first-retry',
  },
  // Same single-server topology as deployment (no proxy): build the client, then
  // boot the Go API which serves the built client itself via static.go. We run in
  // --dev-mode so the server uses a scratch SQLite DB (data/trivia-dev.db) and
  // skips the Auth0 JWKS fetch — which hard-fails offline and would otherwise make
  // the harness depend on Auth0 reachability. CLIENT_DIR points at the built client.
  webServer: {
    command:
      'cd client && npm ci && npm run build && cd ../server/go/src && rm -f data/trivia-dev.db && go run . --dev-mode',
    cwd: repoRoot,
    url: 'http://localhost:8080/',
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      CLIENT_DIR: clientBuildDir,
      PORT: '8080',
    },
  },
  projects: [
    // Chromium first; firefox/webkit are follow-up.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
