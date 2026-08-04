import { describe, expect, it } from 'bun:test';

/**
 * env.server.ts used to hand-list every key when feeding process.env into the zod schema.
 * REMOTE_STATUS_INACTIVITY_MS_PLAYING was missing from that list, so the variable was
 * silently pinned to its default and could not be configured in production.
 *
 * The parse input is now derived from the schema shape. These tests run the module in a
 * child process so the env is applied before its import-time validation.
 */
async function readEnvValue(key: string, env: Record<string, string>): Promise<string> {
    const proc = Bun.spawn(
        [
            'bun',
            '-e',
            `const m = await import('${import.meta.dir}/../../src/server/env.server.ts');`
            // dotenv prints a banner to stdout, so tag the value and pick it back out.
            + `process.stdout.write('<<VALUE>>' + String(m.SERVER_ENV['${key}']));`,
        ],
        {
            env: { ...process.env, NODE_ENV: 'test', ...env },
            stderr: 'pipe',
            stdout: 'pipe',
        },
    );
    const [out] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    return out.slice(out.lastIndexOf('<<VALUE>>') + '<<VALUE>>'.length).trim();
}

describe('SERVER_ENV schema coverage', () => {
    it('honours REMOTE_STATUS_INACTIVITY_MS_PLAYING from the environment', async () => {
        const value = await readEnvValue('REMOTE_STATUS_INACTIVITY_MS_PLAYING', {
            REMOTE_STATUS_INACTIVITY_MS_PLAYING: '99999',
        });
        expect(value).toBe('99999');
    }, 30_000);

    it('honours REMOTE_STATUS_INACTIVITY_MS_PAUSED from the environment', async () => {
        const value = await readEnvValue('REMOTE_STATUS_INACTIVITY_MS_PAUSED', {
            REMOTE_STATUS_INACTIVITY_MS_PAUSED: '88888',
        });
        expect(value).toBe('88888');
    }, 30_000);

    it('still falls back to the schema default when unset', async () => {
        const value = await readEnvValue('REMOTE_STATUS_INACTIVITY_MS_PLAYING', {});
        expect(value).toBe(String(1000 * 60 * 5));
    }, 30_000);
});
