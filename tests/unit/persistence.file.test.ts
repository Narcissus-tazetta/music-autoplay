import fs from 'node:fs';
import path from 'node:path';
import FileStore from '../../src/server/persistence/file';
import { afterEach, beforeEach, describe, expect, it } from '../bunTestCompat';

const TMP_DIR = path.join(process.cwd(), 'tmp_test_data');
const FILE_PATH = path.join(TMP_DIR, 'test_music.json');

describe('FileStore persistence basic operations', () => {
    beforeEach(() => {
        if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
        if (fs.existsSync(FILE_PATH)) fs.unlinkSync(FILE_PATH);
    });

    afterEach(() => {
        try {
            if (fs.existsSync(FILE_PATH)) fs.unlinkSync(FILE_PATH);
        } catch {}
    });

    it('loads empty when file missing and persists add/remove', async () => {
        const store = new FileStore(FILE_PATH);
        const initial = store.load();
        expect(Array.isArray(initial)).toBe(true);
        expect(initial.length).toBe(0);

        const m = { id: 'm1', title: 'T' } as any;
        store.add(m);
        await store.flush();

        const raw = fs.readFileSync(FILE_PATH, 'utf8');
        expect(raw).toContain('m1');
        store.remove('m1');
        await store.flush();
        const after = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        expect(Array.isArray(after.items)).toBe(true);
        expect(after.items.length).toBe(0);
    });

    it('closeSync writes file synchronously', () => {
        const store = new FileStore(FILE_PATH);
        store.addSync({ id: 'x1', title: 'X' } as any);
        store.closeSync();
        const raw = fs.readFileSync(FILE_PATH, 'utf8');
        expect(raw).toContain('x1');
    });
});
