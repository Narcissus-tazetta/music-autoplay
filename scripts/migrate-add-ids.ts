import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { extractYouTubeId } from "../src/shared/utils/youtube";

type RawMusicRequest = {
  url: string;
  title?: string;
  thumbnail?: string;
  channel?: string;
  duration?: string;
  id?: string | null;
  addedAt?: string;
};

type RawData = {
  requests: RawMusicRequest[];
  date?: string;
  lastUpdated?: string;
};

const DATA_DIR = join(process.cwd(), "data");
const MUSIC_FILE = join(DATA_DIR, "musicRequests.json");

if (!existsSync(MUSIC_FILE)) {
  console.log("No musicRequests.json found, nothing to migrate.");
  process.exit(0);
}

try {
  const raw = readFileSync(MUSIC_FILE, "utf-8");
  const json = JSON.parse(raw) as RawData;
  const migrated = json.requests.map(
    (r) =>
      ({
        ...r,
        id: r.id || extractYouTubeId(r.url) || undefined,
      }) as RawMusicRequest,
  );

  json.requests = migrated;
  writeFileSync(MUSIC_FILE, JSON.stringify(json, null, 2), "utf-8");
  console.log(`Migrated ${migrated.length} items to include id`);
} catch (e) {
  console.error("Migration failed:", e);
  process.exit(1);
}
