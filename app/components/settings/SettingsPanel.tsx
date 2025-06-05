// 移動元: ../SettingsPanel.tsx
import React from "react";
import { COLORS } from "~/libs/utils";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode: "dark" | "light";
  setMode: (v: "dark" | "light") => void;
  gaming?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onClose, mode, setMode, gaming }) => {
  // ゲーミング > ダーク > ノーマル
  const theme = gaming ? 'gaming' : mode;
  const currentColors = theme === 'gaming'
    ? { background: '#1a0033', text: '#fff', buttonBackground: '#ff00cc', buttonText: '#fff' }
    : COLORS[mode];
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
        className={`settings-panel h-full w-full flex flex-col p-6 relative ${theme}`}
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
            <span className="block font-medium">ダークモード</span>
            <button
              type="button"
              aria-pressed={mode === "dark"}
              onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              tabIndex={0}
              className={`${mode === "dark" ? "bg-blue-600" : "bg-gray-200"} relative inline-flex h-[28px] w-[52px] items-center rounded-full transition-colors duration-200 ring-1 ring-zinc-600/5 outline-none`}
            >
              <span
                className={`${mode === "dark" ? "translate-x-6" : "translate-x-1"} inline-block h-6 w-6 transform bg-white rounded-full transition-transform duration-200`}
                style={{ background: mode === "dark" ? "#E8EAED" : "#fff" }}
              ></span>
            </button>
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
          <div>
            <span className="font-bold">お問い合わせ:</span>
            <br />
            📧 Gmail: <a href="mailto:clownfish11621@gmail.com" className="text-blue-500 hover:underline mx-1">clownfish11621@gmail.com</a> <br /> 💬 Slack: <a href="https://n-highschool.slack.com/team/U04VDPX7ZHV" className="text-blue-500 hover:underline mx-1">prason</a>
            <br />
            <span className="text-gray-500 text-[10px]">※エラーやバグのご報告、ご意見・ご要望は、以下のメールアドレスまたはSlackにてお気軽にご連絡ください。</span>
          </div>
        </div>
      </div>
    </div>
  );
};
