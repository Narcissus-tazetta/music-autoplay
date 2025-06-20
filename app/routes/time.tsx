import { useState } from "react";
import { useClassSchedule } from "../../time/hooks/use-class-schedule";
import { Footer } from "~/components/footer/Footer";
import { SettingsButton } from "~/components/settings/SettingsButton";
import { SettingsPanel } from "~/components/settings/SettingsPanel";
import { useColorMode } from "~/hooks/use-color-mode";
import { useProgressSettings } from "~/hooks/use-progress-settings";

export function meta() {
  return [
    { title: "残り時間" },
    { name: "description", content: "授業までの残り時間を表示します。" },
  ];
}

export default function Time() {
  const status = useClassSchedule();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, darkClass } = useColorMode();
  // プログレスバー設定を永続化対応のカスタムフックで管理
  const { showProgress, setShowProgress, progressColor, setProgressColor } = useProgressSettings();

  // 色に応じたクラス名
  const progressClass = {
    green: "progress-bright-green",
    blue: "progress-blue-500",
    yellow: "progress-yellow-400",
    pink: "progress-pink-500",
    purple: "progress-purple-500",
    sky: "progress-sky-400",
  }[progressColor];

  return (
    <>
      <div className={`min-h-screen bg-base-200 flex items-center justify-center p-4 ${darkClass}`}>
        <SettingsButton onClick={() => setSettingsOpen(!settingsOpen)} />
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          mode={mode}
          setMode={setMode}
          pageType="time"
          showProgress={showProgress}
          setShowProgress={setShowProgress}
          progressColor={progressColor}
          setProgressColor={setProgressColor}
        />

        <div className="text-center select-none space-y-4">
          {/* 次の時間割まで残り表示 */}
          {status.timeRemaining && status.next && (
            <>
              <div className="text-xl font-bold text-base-content opacity-80">
                {status.next.label}まで残り
              </div>
              <div className="text-4xl font-mono font-bold text-primary">
                {status.timeRemaining}
              </div>
              {/* 進捗バー */}
              {showProgress && (
                <div className="w-80 max-w-full mx-auto mt-6">
                  <progress
                    className={`progress w-full h-3 ${progressClass}`}
                    value={
                      status.remainingMs
                        ? Math.max(0, 100 - (status.remainingMs / (50 * 60 * 1000)) * 100)
                        : 0
                    }
                    max="100"
                  ></progress>
                  <div className="text-xs opacity-60 mt-1">進捗</div>
                </div>
              )}
            </>
          )}

          {/* 現在進行中の場合 */}
          {status.timeRemaining && !status.next && (
            <>
              <div className="text-xl font-bold text-base-content opacity-80">
                現在: {status.current?.label || "不明"}
              </div>
              <div className="text-4xl font-mono font-bold text-primary">
                {status.timeRemaining}
              </div>
              {/* 進捗バー */}
              {showProgress && (
                <div className="w-80 max-w-full mx-auto mt-6">
                  <progress
                    className={`progress w-full h-3 ${progressClass}`}
                    value={
                      status.remainingMs
                        ? Math.max(0, 100 - (status.remainingMs / (50 * 60 * 1000)) * 100)
                        : 0
                    }
                    max="100"
                  ></progress>
                  <div className="text-xs opacity-60 mt-1">進捗</div>
                </div>
              )}
            </>
          )}

          {/* 終了時 */}
          {!status.timeRemaining && (
            <div className="text-3xl font-bold text-base-content">終了</div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
