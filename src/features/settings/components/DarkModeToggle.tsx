interface DarkModeToggleProps {
  mode: "dark" | "light";
  setMode: (v: "dark" | "light") => void;
}

import { Toggle } from "../../../components/ui/shadcn/toggle";

export const DarkModeToggle = ({ mode, setMode }: DarkModeToggleProps) => {
  return (
    <label
      className={`flex items-center justify-between cursor-pointer py-2 ${
        mode === "dark" ? "text-white" : "text-black"
      }`}
    >
      <span className="block font-medium">ダークモード</span>
      <Toggle
        pressed={mode === "dark"}
        onPressedChange={(v) => {
          setMode(v ? "dark" : "light");
        }}
        size="sm"
        aria-label="ダークモード"
      />
    </label>
  );
};
