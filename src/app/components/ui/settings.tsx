import { Label } from "@shadcn/label";
import { ToggleGroup } from "@shadcn/toggle-group";
import { MoonIcon, SparklesIcon, SunIcon } from "lucide-react";
import { Theme, useTheme } from "remix-themes";

export const Settings = () => {
  const [theme, setTheme, meta] = useTheme();

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
    </div>
  );
};
