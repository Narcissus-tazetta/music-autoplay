import { HiFolder, HiCheck, HiX } from "react-icons/hi";

interface BackgroundImageSettingsProps {
  mode: "dark" | "light";
  showBackgroundImage: boolean;
  setShowBackgroundImage: (v: boolean) => void;
  backgroundImage: string;
  setBackgroundImage: (imageData: string, fileName?: string) => Promise<void>;
  backgroundImageFileName: string;
}

export const BackgroundImageSettings: React.FC<BackgroundImageSettingsProps> = ({
  mode,
  showBackgroundImage,
  setShowBackgroundImage,
  backgroundImage,
  setBackgroundImage,
  backgroundImageFileName,
}) => {
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 容量制限を100MBに拡大（IndexedDB使用）
      if (file.size > 100 * 1024 * 1024) {
        window.alert("ファイルサイズは100MB以下にしてください");
        return;
      }
      if (!file.type.startsWith("image/")) {
        window.alert("画像ファイルを選択してください");
        return;
      }

      // HEIC形式やサポートされていない形式を除外
      const supportedFormats = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!supportedFormats.includes(file.type.toLowerCase())) {
        window.alert(
          "サポートされている形式: JPEG, PNG, GIF, WebP\n（HEIC形式はサポートされていません）"
        );
        return;
      }

      try {
        const reader = new window.FileReader();
        reader.onload = async (ev) => {
          const result = ev.target?.result as string;
          await setBackgroundImage(result, file.name);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("画像の読み込みに失敗しました:", error);
        window.alert("画像の読み込みに失敗しました");
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`flex items-center justify-between cursor-pointer py-2 ${
          mode === "dark" ? "text-white" : "text-black"
        }`}
      >
        <span className="block font-medium">背景画像</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={showBackgroundImage}
          onChange={(e) => setShowBackgroundImage(e.target.checked)}
        />
      </label>

      {/* 背景画像の詳細設定（on/offがtrueの場合のみ） */}
      {showBackgroundImage && (
        <div className="ml-4 space-y-3">
          {/* 現在の背景画像情報表示 */}
          {backgroundImage && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {/* HEIC形式の場合は警告アイコン */}
                  {backgroundImage.includes("data:image/png;base64,AAAAIGZ0eXBoZWlj") ? (
                    <HiX className="w-5 h-5 text-red-500" />
                  ) : (
                    <HiCheck className="w-5 h-5 text-blue-500" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {backgroundImageFileName || "選択された画像"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {backgroundImage.includes("data:image/png;base64,AAAAIGZ0eXBoZWlj")
                        ? "❌ HEIC形式はサポートされていません"
                        : "画像が適用されています"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => await setBackgroundImage("", "")}
                  className="w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center"
                  title="削除"
                >
                  <HiX className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ファイル選択エリア */}
          <div className="space-y-2">
            <label className="block">
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  backgroundImage
                    ? "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-600"
                    : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex justify-center">
                    {backgroundImage ? (
                      <HiCheck className="w-8 h-8 text-blue-500" />
                    ) : (
                      <HiFolder className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="text-sm font-medium">
                    {backgroundImage ? "ファイルが選択済み" : "ファイルを選択"}
                  </div>
                  <div className="text-xs opacity-70">100MB以下のJPEG・PNG・GIF・WebP画像</div>
                </div>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            {backgroundImage && (
              <button
                onClick={async () => await setBackgroundImage("", "")}
                className="w-full btn btn-sm btn-outline"
              >
                画像を削除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
