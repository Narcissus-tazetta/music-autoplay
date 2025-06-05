// 移動元: ../SettingsPanel.tsx
import React from "react";
import { COLORS } from "../../libs/utils";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode: "dark" | "light";
  setMode: (v: "dark" | "light") => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onClose, mode, setMode }) => {
  const currentColors = COLORS[mode];
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 320,
        height: "100vh",
        zIndex: 100,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        className={`settings-panel h-full w-full flex flex-col p-6 relative ${mode}`}
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          boxShadow: open ? "-6px 0 24px #0002" : "none",
          background: currentColors.background,
          color: currentColors.text,
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 18,
            right: 16,
            background: "none",
            border: "none",
          }}
          className="text-xl block p-2 hover:bg-zinc-100/20 rounded transition"
          aria-label="閉じる"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-6">設定</h2>
        <div className="flex flex-col gap-4">
          <label className={`flex items-center gap-4 cursor-pointer py-2 ${mode === "dark" ? "text-white" : "text-black"}`}>
          </label>
        </div>
        {/* お問い合わせ先をパネルの最下部に絶対配置 */}
        <div
          className="text-xs opacity-80 border-t pt-4 border-zinc-400/30"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            background: "inherit",
            padding: "16px 24px",
            boxSizing: "border-box",
          }}
        >
        </div>
      </div>
    </div>
  );
};
