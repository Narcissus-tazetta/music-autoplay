import { useSettingsStore } from "@/shared/stores/settingsStore";
import { Label } from "@shadcn/label";
import { ToggleGroup } from "@shadcn/toggle-group";
import { Eye, EyeOff, MoonIcon, SparklesIcon, SunIcon } from "lucide-react";
import { useEffect } from "react";
import { Theme, useTheme } from "remix-themes";

export const Settings = () => {
  const [theme, setTheme, meta] = useTheme();
  const settings = useSettingsStore();
  const ytStatusVisible = settings.ytStatusVisible;
  const setYtStatusVisible = settings.setYtStatusVisible;
  const loadFromServer = settings.loadFromServer;
  const syncToServer = settings.syncToServer;

  useEffect(() => {
    if (typeof loadFromServer === "function") {
      // call and ignore returned promise explicitly
      loadFromServer().catch((e: unknown) => {
        // best-effort: don't surface to UI
        // keep minimal logging to console for debugging

        console.warn("loadFromServer failed", e);
      });
    }
  }, [loadFromServer]);

  useEffect(() => {
    if (typeof syncToServer === "function") {
      // call and ignore returned promise explicitly
      syncToServer().catch((e: unknown) => {
        console.warn("syncToServer failed", e);
      });
    }
  }, [syncToServer, ytStatusVisible]);

  return (
    <div className="flex flex-col gap-4 p-4 ">
      <Label className="flex items-center gap-2 bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)]">
        テーマ
      </Label>
      <ToggleGroup
        type="single"
        variant="outline"
        unselectable="off"
        value={meta.definedBy === "USER" ? (theme ?? "system") : "system"}
        onValueChange={(theme) => {
          if (theme) setTheme(theme === "system" ? null : (theme as Theme));
        }}
        className="w-full"
      >
        <ToggleGroup.Item value="light" className="w-full">
          <SunIcon />
        </ToggleGroup.Item>
        <ToggleGroup.Item value="system" className="w-full">
          <SparklesIcon />
        </ToggleGroup.Item>
        <ToggleGroup.Item value="dark" className="w-full">
          <MoonIcon />
        </ToggleGroup.Item>
      </ToggleGroup>

      <div />
      <Label className="flex items-center gap-2 bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)]">
        YouTube status
      </Label>

      <ToggleGroup
        type="single"
        variant="outline"
        unselectable="off"
        value={ytStatusVisible ? "on" : "off"}
        onValueChange={(v) => {
          if (v) setYtStatusVisible(v === "on");
        }}
        className="w-full"
      >
        <ToggleGroup.Item
          value="on"
          className="w-full flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          <span>表示</span>
        </ToggleGroup.Item>
        <ToggleGroup.Item
          value="off"
          className="w-full flex items-center justify-center gap-2"
        >
          <EyeOff className="w-4 h-4" />
          <span>非表示</span>
        </ToggleGroup.Item>
      </ToggleGroup>
    </div>
  );
};
