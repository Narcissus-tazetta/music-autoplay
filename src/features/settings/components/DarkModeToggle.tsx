import React, { useCallback, useRef } from "react";
import { HiMoon, HiSun, HiDeviceMobile } from "react-icons/hi";

interface DarkModeToggleProps {
    mode: "dark" | "light" | "system";
    setMode: (v: "dark" | "light" | "system") => void;
}

const OPTIONS: Array<DarkModeToggleProps["mode"]> = ["light", "dark", "system"];

export const DarkModeToggle = ({ mode, setMode }: DarkModeToggleProps) => {
    const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const getBtnClass = (selected: boolean) =>
        `inline-flex items-center justify-center rounded-md p-2 transition-colors border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 ${
            selected
                ? "bg-blue-500 text-white border-transparent"
                : "bg-transparent text-current border-gray-200 hover:bg-gray-100"
        }`;

    const onKeyDown = useCallback(
        (ev: React.KeyboardEvent) => {
            const idx = OPTIONS.indexOf(mode);
            if (idx === -1) return;
            if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
                ev.preventDefault();
                const next = (idx + 1) % OPTIONS.length;
                setMode(OPTIONS[next]);
                btnRefs.current[next]?.focus();
            } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
                ev.preventDefault();
                const prev = (idx - 1 + OPTIONS.length) % OPTIONS.length;
                setMode(OPTIONS[prev]);
                btnRefs.current[prev]?.focus();
            }
        },
        [mode, setMode]
    );

    return (
        <div className="py-2">
            <span className="block font-medium mb-2">ダークモード</span>

            <div
                role="radiogroup"
                aria-label="ダークモード選択"
                className="flex items-center gap-2"
                onKeyDown={onKeyDown}
            >
                <button
                    ref={(el) => {
                        btnRefs.current[0] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={mode === "light"}
                    aria-label="ライト"
                    onClick={() => { setMode("light"); }}
                    className={getBtnClass(mode === "light")}
                >
                    <HiSun className="w-5 h-5 text-yellow-400" aria-hidden />
                </button>

                <button
                    ref={(el) => {
                        btnRefs.current[1] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={mode === "dark"}
                    aria-label="ダーク"
                    onClick={() => { setMode("dark"); }}
                    className={getBtnClass(mode === "dark")}
                >
                    <HiMoon className="w-5 h-5 text-gray-200" aria-hidden />
                </button>

                <button
                    ref={(el) => {
                        btnRefs.current[2] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={mode === "system"}
                    aria-label="デバイス設定に従う"
                    onClick={() => { setMode("system"); }}
                    className={getBtnClass(mode === "system")}
                >
                    <HiDeviceMobile className="w-5 h-5 text-green-400" aria-hidden />
                </button>
            </div>
        </div>
    );
};
