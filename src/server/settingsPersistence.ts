import logger from '@/server/logger';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE_PATH = path.resolve(process.cwd(), 'data', 'settings.json');

type PersistFile = Record<
    string,
    { value: Record<string, unknown>; lastUpdated: string } | undefined
>;

export class SettingsStore {
    private filePath: string;
    private current: PersistFile | null = null;

    constructor(filePath?: string) {
        this.filePath = filePath ?? DEFAULT_FILE_PATH;
        this.ensureDataDir();
    }

    private ensureDataDir() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    private readFileSafeSync(): PersistFile {
        try {
            if (!fs.existsSync(this.filePath)) return {};
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(raw) as PersistFile;
            return parsed;
        } catch (error) {
            logger.warn('settingsPersistence: failed to read file', { error: error });
            return {};
        }
    }

    private writeFileAtomicSync(obj: unknown) {
        const payload = JSON.stringify(obj, undefined, 2);
        const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        try {
            fs.writeFileSync(tmp, payload, 'utf8');
            fs.renameSync(tmp, this.filePath);
        } catch (error) {
            try {
                if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
            } catch (error) {
                logger.warn('settingsPersistence: failed to cleanup temp file', {
                    error: error,
                });
            }
            throw error;
        }
    }

    load(userId: string) {
        if (!this.current) this.current = this.readFileSafeSync();
        return this.current[userId] || undefined;
    }

    save(userId: string, value: Record<string, unknown>) {
        if (!this.current) this.current = this.readFileSafeSync();
        this.current[userId] = { lastUpdated: new Date().toISOString(), value };
        this.writeFileAtomicSync(this.current);
    }
}

export const defaultSettingsStore = new SettingsStore();

export default SettingsStore;
