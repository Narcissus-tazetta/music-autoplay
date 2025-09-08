import { useState } from "react";
import { BackgroundImageSettings } from "./BackgroundImageSettings";
import { ContactInfo } from "./ContactInfo";
import { DarkModeToggle } from "./DarkModeToggle";

interface SettingsPanelProps {
    open: boolean;
    onClose: () => void;
    mode: "dark" | "light" | "system";
    setMode: (v: "dark" | "light" | "system") => void;
    pageType?: string;

    backgroundImage?: string;
    setBackgroundImage?: (v: string) => Promise<void>;
    backgroundImageFileName?: string;
    showBackgroundImage?: boolean;
    setShowBackgroundImage?: (v: boolean) => void;

    backgroundFeatureEnabled?: boolean;
}

export const SettingsPanel = ({
    open,
    onClose,
    mode,
    setMode,
    pageType,
    backgroundImage,
    setBackgroundImage,
    backgroundImageFileName,
    showBackgroundImage,
    setShowBackgroundImage,
    backgroundFeatureEnabled,
}: SettingsPanelProps) => {
    const currentColors = {
        background: "var(--color-bg, #fff)",
        text: "var(--color-fg, #212225)",
    };
    const [activeTab, setActiveTab] = useState<"settings" | "advanced">("settings");

    const isTimePage = pageType === "time";

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
                className={`h-full w-full flex flex-col p-6 relative transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${mode}`}
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
                    className="text-xl block p-2 hover:bg-zinc-100/20 rounded transition-all duration-200 ease-in-out"
                    aria-label="閉じる"
                >
                    ×
                </button>

                <div className="flex mb-6 border-b border-zinc-400/30">
                    <button
                        onClick={() => {
                            setActiveTab("settings");
                        }}
                        className={`px-4 py-2 font-semibold transition-all 0.2s cubic-bezier(0.4,0,0.2,1) ${
                            activeTab === "settings"
                                ? "text-blue-500 border-b-2 border-blue-500"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        設定
                    </button>
                    {isTimePage && (
                        <button
                            onClick={() => {
                                setActiveTab("advanced");
                            }}
                            className={`px-4 py-2 font-semibold transition-all 0.2s cubic-bezier(0.4,0,0.2,1) ${
                                activeTab === "advanced"
                                    ? "text-blue-500 border-b-2 border-blue-500"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            詳細設定
                        </button>
                    )}
                </div>

                {activeTab === "settings" && (
                    <div className="flex flex-col gap-4">
                        <DarkModeToggle mode={mode} setMode={setMode} />
                        {/* テーマボタンを削除 */}

                        {isTimePage &&
                            backgroundFeatureEnabled &&
                            showBackgroundImage !== undefined &&
                            setShowBackgroundImage &&
                            backgroundImage !== undefined &&
                            setBackgroundImage && (
                                <BackgroundImageSettings
                                    mode={mode}
                                    showBackgroundImage={showBackgroundImage}
                                    setShowBackgroundImage={setShowBackgroundImage}
                                    backgroundImage={backgroundImage}
                                    setBackgroundImage={setBackgroundImage}
                                    backgroundImageFileName={backgroundImageFileName || ""}
                                />
                            )}
                    </div>
                )}

                <ContactInfo />
            </div>
        </div>
    );
};
