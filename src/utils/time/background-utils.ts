/**
 * 背景画像関連のユーティリティ関数
 */

export interface BackgroundImageStyle {
    backgroundImage?: string;
    backgroundSize: string;
    backgroundPosition: string;
    backgroundRepeat: string;
}

/**
 * 背景画像の設定に基づいてスタイルオブジェクトを生成
 */
export function createBackgroundStyle(
    showBackgroundImage: boolean,
    backgroundImage: string | null,
): BackgroundImageStyle {
    return {
        backgroundImage: showBackgroundImage && backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    };
}
