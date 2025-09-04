// パス再構成後の colorModeStore 位置修正
import { useColorModeStore } from "../../features/settings/stores/colorModeStore";
import { useGamingToggle } from "../../hooks/use-gaming-toggle";

export const Footer: React.FC = () => {
    const mode = useColorModeStore((s) => s.mode);
    const gamingAlinco = useGamingToggle("^");
    const gamingNarcissus = useGamingToggle("\u00a5");
    const location = typeof window !== "undefined" ? window.location.pathname : "";

    return (
        <footer
            className="footer w-full py-2 flex flex-col items-center justify-center text-[11px] opacity-80 fixed left-0 bottom-0 z-50 bg-app-bg text-app-fg shadow-[0_-2px_12px_0_rgba(0,0,0,0.04)]"
            style={{
                borderTop: "1px solid var(--color-border)",
                transition:
                    "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1), border-color 0.2s cubic-bezier(0.4,0,0.2,1)",
            }}
        >
            {location !== "/time" && (
                <div className="leading-tight">
                    supported by{" "}
                    <a
                        href="https://github.com/alinco8"
                        className={`mx-1 hover:underline${gamingAlinco ? " gaming-color" : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ transition: "color 0.2s cubic-bezier(0.4,0,0.2,1)" }}
                    >
                        alinco8
                    </a>
                </div>
            )}
            <div className="text-[10px] mt-1 opacity-70 select-none leading-tight">
                &copy; {new Date().getFullYear()}{" "}
                <a
                    href="https://github.com/Narcissus-tazetta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`footer-link-normal${gamingNarcissus ? " gaming-color" : ""}`}
                >
                    Narcissus-tazetta
                </a>
            </div>
        </footer>
    );
};
