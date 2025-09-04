#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, "..", "data", "musicRequests.json");
const backupPath = dataPath + ".bak";

export default function seed() {
  if (fs.existsSync(dataPath)) {
    fs.copyFileSync(dataPath, backupPath);
  }
  fs.writeFileSync(dataPath, "[]", "utf8");
  console.log("Seeded", dataPath);
}

if (process.argv[1] && process.argv[1].endsWith("test-seed.js")) seed();
