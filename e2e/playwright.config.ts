import { defineConfig, devices } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const clientBuildDir = path.join(repoRoot, 'client', 'build');
const dbPath = path.join(os.tmpdir(), 'trivia-e2e.db');

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
  // boot the Go API which serves the built client itself via static.go. DB_PATH
  // points at a temp SQLite file and CLIENT_DIR at the built client.
  webServer: {
    command:
      'cd client && npm ci && npm run build && cd ../server/go/src && rm -f "$DB_PATH" && go run .',
    cwd: repoRoot,
    url: 'http://localhost:8080/',
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      DB_PATH: dbPath,
      CLIENT_DIR: clientBuildDir,
      PORT: '8080',
    },
  },
  projects: [
    // Chromium first; firefox/webkit are follow-up.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
