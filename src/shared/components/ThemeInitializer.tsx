import { useEffect } from "react";
import { useColorModeStore } from "../../features/settings/stores/colorModeStore";
import { applyModeToDocument, ensureSystemListener, readStoredMode } from "../utils/theme";

export function ThemeInitializer() {
    const mode = useColorModeStore((s) => s.mode);

    useEffect(() => {
        // On client hydration, ensure the document reflects the stored mode.
        // Use readStoredMode so that if localStorage has a value it takes precedence.
        try {
            const stored = readStoredMode();
            const effectiveMode = stored ?? mode;
            applyModeToDocument(effectiveMode);
            if (effectiveMode === "system") ensureSystemListener();
        } catch (e) {
            // ignore
        }
    }, [mode]);

    return null;
}
