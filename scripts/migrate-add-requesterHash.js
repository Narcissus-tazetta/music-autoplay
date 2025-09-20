/* eslint-env node, es2022 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const filePath = path.resolve(process.cwd(), "data", "musicRequests.json");
const backupPath = `${filePath}.backup.${Date.now()}`;

function exitWith(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(filePath)) exitWith(`File not found: ${filePath}`);

console.log(`Backing up ${filePath} -> ${backupPath}`);
fs.copyFileSync(filePath, backupPath);

let data;
try {
  data = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (err) {
  console.error("Failed to parse JSON:", err);
  process.exit(1);
}

const items = data.items || data.requests;
if (!Array.isArray(items))
  exitWith("Unexpected data format: 'items' or 'requests' array missing");

let changed = false;
for (const item of items) {
  if (
    !Object.prototype.hasOwnProperty.call(item, "requesterHash") ||
    item.requesterHash == null
  ) {
    const seed = item.requester ?? item.id ?? "";
    item.requesterHash = crypto
      .createHash("sha256")
      .update(String(seed))
      .digest("hex");
    changed = true;
  }
}

if (changed) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log("Migration applied: requesterHash added where missing.");
  } catch (err) {
    console.error("Failed to write JSON:", err);
    process.exit(1);
  }
} else {
  console.log("No changes necessary.");
}
