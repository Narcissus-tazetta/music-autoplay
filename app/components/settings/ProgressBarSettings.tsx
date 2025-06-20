type ProgressColor = "blue" | "yellow" | "green" | "pink" | "purple" | "sky";

interface ProgressBarSettingsProps {
  mode: "dark" | "light";
  showProgress: boolean;
  setShowProgress: (v: boolean) => void;
  progressColor: ProgressColor;
  setProgressColor: (v: ProgressColor) => void;
}

export const ProgressBarSettings: React.FC<ProgressBarSettingsProps> = ({
  mode,
  showProgress,
  setShowProgress,
  progressColor,
  setProgressColor,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* 進捗表示設定 */}
      <label
        className={`flex items-center gap-4 cursor-pointer py-2 ${mode === "dark" ? "text-white" : "text-black"}`}
      >
        <span className="block font-medium">進捗バー表示</span>
        <button
          type="button"
          aria-pressed={showProgress}
          onClick={() => setShowProgress(!showProgress)}
          tabIndex={0}
          className={`${showProgress ? "bg-blue-600" : "bg-gray-200"} relative inline-flex h-[28px] w-[52px] items-center rounded-full transition-colors duration-200 ring-1 ring-zinc-600/5 outline-none`}
        >
          <span
            className={`${showProgress ? "translate-x-6" : "translate-x-1"} inline-block h-6 w-6 transform bg-white rounded-full transition-transform duration-200`}
            style={{ background: showProgress ? "#E8EAED" : "#fff" }}
          ></span>
        </button>
      </label>

      {/* 進捗バー色選択（進捗表示がONの場合のみ） */}
      {showProgress && (
        <div className="flex flex-col gap-2">
          <span className={`block font-medium ${mode === "dark" ? "text-white" : "text-black"}`}>
            進捗バーの色
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setProgressColor("blue")}
              className={`w-8 h-8 rounded-full bg-blue-500 border-2 transition-all ${
                progressColor === "blue" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("sky")}
              className={`w-8 h-8 rounded-full bg-sky-400 border-2 transition-all ${
                progressColor === "sky" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("green")}
              className={`w-8 h-8 rounded-full bg-green-500 border-2 transition-all ${
                progressColor === "green" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("yellow")}
              className={`w-8 h-8 rounded-full bg-yellow-400 border-2 transition-all ${
                progressColor === "yellow" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("pink")}
              className={`w-8 h-8 rounded-full bg-pink-500 border-2 transition-all ${
                progressColor === "pink" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("purple")}
              className={`w-8 h-8 rounded-full bg-purple-500 border-2 transition-all ${
                progressColor === "purple" ? "border-white scale-110" : "border-transparent"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
