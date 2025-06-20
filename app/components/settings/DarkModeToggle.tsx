interface DarkModeToggleProps {
  mode: "dark" | "light";
  setMode: (v: "dark" | "light") => void;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ mode, setMode }) => {
  return (
    <label
      className={`flex items-center gap-4 cursor-pointer py-2 ${mode === "dark" ? "text-white" : "text-black"}`}
    >
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
  );
};
