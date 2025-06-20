import { useState } from "react";
import { COLORS } from "~/libs/utils";
import { DarkModeToggle } from "./DarkModeToggle";
import { ProgressBarSettings } from "./ProgressBarSettings";
import { ContactInfo } from "./ContactInfo";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode: "dark" | "light";
  setMode: (v: "dark" | "light") => void;
  pageType?: string;
  showProgress?: boolean;
  setShowProgress?: (v: boolean) => void;
  progressColor?: "blue" | "yellow" | "green" | "pink" | "purple" | "sky";
  setProgressColor?: (v: "blue" | "yellow" | "green" | "pink" | "purple" | "sky") => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const {
    open,
    onClose,
    mode,
    setMode,
    pageType,
    showProgress: showProgressProp,
    setShowProgress: setShowProgressProp,
    progressColor: progressColorProp,
    setProgressColor: setProgressColorProp,
  } = props;
  const currentColors = COLORS[mode];
  const [activeTab, setActiveTab] = useState<"settings" | "advanced">("settings");
  // showProgress, progressColor, setShowProgress, setProgressColorはpropsから受け取る
  // fallbackは内部state（ただし/timeでは必ずpropsが渡る想定）
  const [internalShowProgress, internalSetShowProgress] = useState(true);
  const [internalProgressColor, internalSetProgressColor] = useState<
    "blue" | "yellow" | "green" | "pink" | "purple" | "sky"
  >("green");
  const showProgress =
    typeof showProgressProp === "boolean" ? showProgressProp : internalShowProgress;
  const setShowProgress = setShowProgressProp || internalSetShowProgress;
  const progressColor = progressColorProp || internalProgressColor;
  const setProgressColor = setProgressColorProp || internalSetProgressColor;
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

        {/* タブボタン */}
        <div className="flex mb-6 border-b border-zinc-400/30">
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 font-semibold transition-colors duration-200 ${
              activeTab === "settings"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            設定
          </button>
          {pageType === "time" && (
            <button
              onClick={() => setActiveTab("advanced")}
              className={`px-4 py-2 font-semibold transition-colors duration-200 ${
                activeTab === "advanced"
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              詳細設定
            </button>
          )}
        </div>

        {/* 設定タブの内容 */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-4">
            <DarkModeToggle mode={mode} setMode={setMode} />
          </div>
        )}

        {/* 詳細設定タブの内容（/timeページでのみ表示） */}
        {activeTab === "advanced" && pageType === "time" && (
          <ProgressBarSettings
            mode={mode}
            showProgress={showProgress}
            setShowProgress={setShowProgress}
            progressColor={progressColor}
            setProgressColor={setProgressColor}
          />
        )}

        <ContactInfo />
      </div>
    </div>
  );
};
