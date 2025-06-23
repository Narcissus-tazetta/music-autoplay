import type { LoaderFunctionArgs } from "react-router";
import { readFileSync } from "fs";
import { join } from "path";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // publicディレクトリからfaviconを読み込み
    const faviconPath = join(process.cwd(), "public", "favicon.ico");
    const favicon = readFileSync(faviconPath);

    return new Response(favicon, {
      status: 200,
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=86400", // 24時間キャッシュ
      },
    });
  } catch (error) {
    // ファイルが見つからない場合は404を返す
    return new Response("Not Found", { status: 404 });
  }
}
