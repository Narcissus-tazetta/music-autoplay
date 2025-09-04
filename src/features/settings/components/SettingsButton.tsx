export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="設定"
      style={{
        position: "absolute",
        top: 16,
        right: 24,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 4,
        zIndex: 10,
        transition:
          "var(--transition-colors, opacity 0.2s cubic-bezier(0.4,0,0.2,1))",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect
          y="6"
          width="28"
          height="2.5"
          rx="1.25"
          fill="var(--color-fg, #666)"
        />
        <rect
          y="13"
          width="28"
          height="2.5"
          rx="1.25"
          fill="var(--color-fg, #666)"
        />
        <rect
          y="20"
          width="28"
          height="2.5"
          rx="1.25"
          fill="var(--color-fg, #666)"
        />
      </svg>
    </button>
  );
}
