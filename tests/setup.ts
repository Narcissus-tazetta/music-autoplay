process.env.NODE_ENV = 'test';
process.env.YOUTUBE_API_KEY = 'test-youtube-api-key-for-unit-tests';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long';
process.env.ADMIN_SECRET = 'test-admin-secret-must-be-at-least-32-characters-long';
process.env.ADMIN_USER = 'test-admin';
process.env.ADMIN_PASSWORD = 'test-password-123';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';

// getHistoryService()/getRequestLogService() lazily build a file-backed service pointing at
// data/history.json and data/request-logs.json. Socket handlers reach for those singletons,
// so running the suite used to rewrite the developer's real history: the write is debounced
// by 500ms, which hid it in single-file runs and only surfaced during a full run.
//
// Installing scratch-backed singletons before any test imports them keeps data/ untouched.
// This must come after the env assignments above, since these modules read SERVER_ENV.
const { mkdtempSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { HistoryService, setHistoryService } = await import('../src/server/history/historyService');
const { RequestLogService, setRequestLogService } = await import(
    '../src/server/requestLog/requestLogService'
);

/**
 * Exported for two reasons: tests that want a scratch path can reuse it, and the export is
 * what makes this file a module, which the top-level awaits above require. A bare `export {}`
 * does not survive `oxlint --fix` in the pre-commit hook.
 *
 * The imports have to stay dynamic: static ones are hoisted above the env assignments, and
 * these modules read SERVER_ENV at import time.
 */
export const testDataDir = mkdtempSync(join(tmpdir(), 'music-auto-play-test-'));

setHistoryService(new HistoryService(join(testDataDir, 'history.json')));
setRequestLogService(new RequestLogService(join(testDataDir, 'request-logs.json')));
