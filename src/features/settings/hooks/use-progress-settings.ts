import { useEffect, useRef, useState } from "react";
import { indexedDBManager } from "../../../libs/indexedDB";
import { log } from "../../../utils/clientLogger";

export function useProgressSettings() {
    const [backgroundImage, setBackgroundImageState] = useState<string>("");
    const [backgroundImageFileName, setBackgroundImageFileNameState] = useState<string>("");
    const isMounted = useRef(true);

    useEffect(() => {
        const loadBackgroundImage = async () => {
            try {
                if (typeof window === "undefined") return;

                const savedBackgroundImageData = await indexedDBManager.getImage();
                if (savedBackgroundImageData && savedBackgroundImageData.data && isMounted.current) {
                    setBackgroundImageState(savedBackgroundImageData.data);
                    setBackgroundImageFileNameState(savedBackgroundImageData.fileName || "");
                }
            } catch (error) {
                if (!isMounted.current) return;
                log.error("背景画像の読み込みに失敗しました", error, "useProgressSettings");
                try {
                    const fallbackImage = localStorage.getItem("backgroundImage");
                    if (fallbackImage) setBackgroundImageState(fallbackImage);
                } catch (fallbackError) {
                    log.error("localStorageからのフォールバック読み込みも失敗", fallbackError, "useProgressSettings");
                }
            }
        };

        loadBackgroundImage().catch((error: unknown) => {
            log.error("背景画像の読み込み処理でエラー", error, "useProgressSettings");
        });

        return () => {
            isMounted.current = false;
        };
    }, []);

    const setBackgroundImage = async (imageData: string, fileName?: string) => {
        let nameToSave = fileName;
        if (!nameToSave) nameToSave = `image_${Date.now()}.png`;
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
            log.error("背景画像の保存に失敗しました", error, "useProgressSettings");
            if (imageData) {
                try {
                    localStorage.setItem("backgroundImage", imageData);
                } catch (localStorageError) {
                    log.error("localStorageへの保存も失敗しました", localStorageError, "useProgressSettings");
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
