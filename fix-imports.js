#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

// パス置換マッピング
const pathReplacements = [
  // ~/socket -> 相対パス
  {
    from: `import type { C2S, S2C } from "~/socket";`,
    to: `import type { C2S, S2C } from "../app/socket";`,
  },
  {
    from: `import { socket } from "~/socket";`,
    to: `import { socket } from "../app/socket";`,
  },

  // ~/stores -> 相対パス
  {
    from: `import type { Music } from "~/stores/musicStore";`,
    to: `import type { Music } from "../features/music/stores/musicStore";`,
  },

  // ~/hooks -> 相対パス
  {
    from: `import { useClientOnly } from "~/hooks/time/use-client-only";`,
    to: `import { useClientOnly } from "../shared/hooks/time/use-client-only";`,
  },

  // 相対パスの修正
  {
    from: `"../../shared/stores/adminStore"`,
    to: `"../../shared/stores/adminStore"`,
  },
  {
    from: `"../../shared/components/`,
    to: `"../../shared/components/`,
  },
  {
    from: `"../../shared/libs/utils"`,
    to: `"../../shared/libs/utils"`,
  },
  {
    from: `"../../shared/libs/indexedDB"`,
    to: `"../../shared/libs/indexedDB"`,
  },
  {
    from: `"../../features/music/stores/musicStore"`,
    to: `"../../features/music/stores/musicStore"`,
  },
  {
    from: `"../../features/settings/stores/colorModeStore"`,
    to: `"../../features/settings/stores/colorModeStore"`,
  },
  {
    from: `"../../features/settings/stores/progressSettingsStore"`,
    to: `"../../features/settings/stores/progressSettingsStore"`,
  },
  {
    from: `"../../shared/utils/time/`,
    to: `"../../shared/utils/time/`,
  },
];

// ファイルを修正
async function fixImports() {
  try {
    const files = await glob("src/**/*.{ts,tsx}", { ignore: "node_modules/**" });

    for (const file of files) {
      let content = readFileSync(file, "utf8");
      let modified = false;

      for (const replacement of pathReplacements) {
        if (content.includes(replacement.from)) {
          content = content.replaceAll(replacement.from, replacement.to);
          modified = true;
        }
      }

      if (modified) {
        writeFileSync(file, content);
        console.log(`Fixed: ${file}`);
      }
    }

    console.log("Import fixing completed!");
  } catch (error) {
    console.error("Error fixing imports:", error);
  }
}

fixImports();
