import fs from "fs";
import path from "path";
import logger from "@/server/logger";

const DEFAULT_FILE_PATH = path.resolve(process.cwd(), "data", "settings.json");

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
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistFile;
      return parsed;
    } catch (e) {
      logger.warn("settingsPersistence: failed to read file", { error: e });
      return {};
    }
  }

  private writeFileAtomicSync(obj: unknown) {
    const payload = JSON.stringify(obj, null, 2);
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(tmp, payload, "utf8");
      fs.renameSync(tmp, this.filePath);
    } catch (e) {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch (cleanupErr: unknown) {
        logger.warn("settingsPersistence: failed to cleanup temp file", {
          error: cleanupErr,
        });
      }
      throw e;
    }
  }

  load(userId: string) {
    if (!this.current) this.current = this.readFileSafeSync();
    return this.current[userId] || null;
  }

  save(userId: string, value: Record<string, unknown>) {
    if (!this.current) this.current = this.readFileSafeSync();
    this.current[userId] = { value, lastUpdated: new Date().toISOString() };
    this.writeFileAtomicSync(this.current);
  }
}

export const defaultSettingsStore = new SettingsStore();

export default SettingsStore;
