// 移動元: ../Footer.tsx
import { useEffect, useState } from "react";
import { useGamingToggle } from "~/hooks/use-gaming-toggle";

export const Footer: React.FC = () => {
  const [mode, setMode] = useState<'dark' | 'light'>('light');
  const gamingAlinco = useGamingToggle('^');
  const gamingNarcissus = useGamingToggle('¥');

  useEffect(() => {
    const updateMode = () => {
      if (document.body.classList.contains('dark-mode')) setMode('dark');
      else setMode('light');
    };
    updateMode();
    const observer = new MutationObserver(updateMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // ゲーミング > ダーク > ノーマル
  const theme = gamingAlinco || gamingNarcissus ? 'gaming' : mode;
  const themeColors = theme === 'gaming'
    ? { background: '#1a0033', text: '#fff', border: '#ff00cc' }
    : (mode === 'dark'
      ? { background: '#212225', text: '#E8EAED', border: '#444' }
      : { background: '#fff', text: '#212225', border: '#e5e7eb' });

  return (
    <footer
      className="footer w-full py-2 flex flex-col items-center justify-center text-[11px] opacity-80 fixed left-0 bottom-0 z-50"
      style={{
        background: themeColors.background,
        color: themeColors.text,
        boxShadow: "0 -2px 12px 0 rgba(0,0,0,0.04)",
        borderTop: `1px solid ${themeColors.border}`,
        transition: "background 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div className="leading-tight">
        supported by{" "}
        <a
          href="https://github.com/alinco8"
          className={`text-blue-500 hover:underline mx-1${gamingAlinco ? " gaming-color" : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ transition: "color 0.2s" }}
        >
          alinco8
        </a>
      </div>
      <div className="text-[10px] mt-1 opacity-70 select-none leading-tight">
        &copy; {new Date().getFullYear()} <a href="https://github.com/Narcissus-tazetta" target="_blank" rel="noopener noreferrer" className={`footer-link-normal${gamingNarcissus ? " gaming-color" : ""}`}>Narcissus-tazetta</a>
      </div>
    </footer>
  );
};
