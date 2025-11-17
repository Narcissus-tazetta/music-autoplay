import { useSettingsSync } from "@/app/hooks/useSettingsSync";
import { Label } from "@shadcn/label";
import { ToggleGroup } from "@shadcn/toggle-group";
import { Eye, EyeOff, MoonIcon, SparklesIcon, SunIcon } from "lucide-react";
import { memo } from "react";
import { type Theme, useTheme } from "remix-themes";

function SettingsInner() {
  const [theme, setTheme, meta] = useTheme();
  const { ytStatusVisible, setYtStatusVisible } = useSettingsSync();

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
}

export const Settings = memo(SettingsInner);
