// 共通ユーティリティ（内容はserver.tsから移植、ロジックは一切変更しない）
export function extractYouTubeId(url: string): string | null {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === "youtu.be") {
            return urlObj.pathname.replace(/^\//, "");
        }
        if (urlObj.hostname.includes("youtube.com")) {
            return urlObj.searchParams.get("v");
        }
    } catch {
        const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
        return match ? match[1] : null;
    }
    return null;
}
