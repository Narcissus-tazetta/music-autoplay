import { useState, useEffect } from "react";
import { indexedDBManager } from "~/libs/indexedDB";

export function useProgressSettings() {
  // 背景画像設定のみ残す（IndexedDB使用のため）
  const [backgroundImage, setBackgroundImageState] = useState<string>("");
  const [backgroundImageFileName, setBackgroundImageFileNameState] = useState<string>("");

  useEffect(() => {
    // 背景画像設定をIndexedDBから読み込み
    const loadBackgroundImage = async () => {
      try {
        if (typeof window === "undefined" || !window.indexedDB) {
          return;
        }

        const savedBackgroundImageData = await indexedDBManager.getImage();
        if (savedBackgroundImageData && savedBackgroundImageData.data) {
          setBackgroundImageState(savedBackgroundImageData.data);
          setBackgroundImageFileNameState(savedBackgroundImageData.fileName || "");
        }
      } catch (error) {
        console.error("背景画像の読み込みに失敗しました:", error);
        try {
          const fallbackImage = localStorage.getItem("backgroundImage");
          if (fallbackImage) {
            setBackgroundImageState(fallbackImage);
          }
        } catch (fallbackError) {
          console.error("localStorageからのフォールバック読み込みも失敗:", fallbackError);
        }
      }
    };

    loadBackgroundImage().catch((error) => {
      console.error("loadBackgroundImage実行中にエラー:", error);
    });
  }, []);

  const setBackgroundImage = async (imageData: string, fileName?: string) => {
    let nameToSave = fileName;
    if (!nameToSave) {
      nameToSave = `image_${Date.now()}.png`;
    }
    setBackgroundImageState(imageData);
    setBackgroundImageFileNameState(nameToSave);
    try {
      if (imageData) {
        await indexedDBManager.saveImage(imageData, nameToSave);
        localStorage.removeItem("backgroundImage");
      } else {
        await indexedDBManager.deleteImage();
        localStorage.removeItem("backgroundImage");
      }
    } catch (error) {
      console.error("背景画像の保存に失敗しました:", error);
      if (imageData) {
        try {
          localStorage.setItem("backgroundImage", imageData);
        } catch (localStorageError) {
          console.error("localStorageへの保存も失敗しました:", localStorageError);
          window.alert("画像が大きすぎて保存できませんでした。より小さい画像を選択してください。");
        }
      } else {
        localStorage.removeItem("backgroundImage");
      }
    }
  };

  return {
    backgroundImage,
    setBackgroundImage,
    backgroundImageFileName,
  };
}
