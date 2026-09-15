// One API server per Playwright worker, each against its own SQLite file.
//
// The suite used to run serially (`workers: 1`) because a single server meant a
// single shared database: tests would have seen each other's rows, and the list
// pages are paginated, so a row seeded by a neighbouring test could push the row
// under test onto page 2. Giving every worker a server and a database of its own
// removes the sharing rather than coordinating around it, which is what lets the
// suite run in parallel.
//
// Both this module's consumers — playwright.config.ts and the gameplay spec, which
// builds its own browser contexts — resolve the same port for the current worker,
// so there is one source of truth for which server a test is talking to.

/** Port of the first worker's server. Worker N listens on BASE_PORT + N. */
export const BASE_PORT = 8081;

/**
 * Workers to run, and therefore servers to boot. Each worker costs a browser and
 * a Go server, so the default is deliberately lower on CI's 4-vCPU runners than
 * on a dev box. E2E_WORKERS overrides it either way — E2E_WORKERS=1 is the old
 * serial behaviour, useful when a failure looks like a parallelism artifact.
 */
export const WORKERS = Number(process.env.E2E_WORKERS || (process.env.CI ? 2 : 4));

export const serverPort = (worker: number) => BASE_PORT + worker;

/** The scratch database for a worker's server, relative to server/go/src. */
export const workerDbPath = (worker: number) => `data/trivia-e2e-${worker}.db`;

/**
 * The port this process should talk to. Playwright sets TEST_PARALLEL_INDEX in
 * every worker process and loads the config there too, so the config's
 * `use.baseURL` and the specs both land on the worker's own server. It is unset
 * in the main process (during `--list`, say), where worker 0 is the right answer.
 */
export const workerPort = () => serverPort(Number(process.env.TEST_PARALLEL_INDEX || 0));

export const workerBaseURL = () => `http://localhost:${workerPort()}/`;
