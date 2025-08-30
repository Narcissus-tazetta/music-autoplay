import { readFileSync } from "fs";
import { join } from "path";
import { log } from "../../../server/logger";

export const loader = () => {
    try {
        const faviconPath = join(process.cwd(), "public", "favicon.ico");
        const favicon = readFileSync(faviconPath);

        return new Response(favicon, {
            status: 200,
            headers: {
                "Content-Type": "image/x-icon",
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (error) {
        log.error("Failed to load favicon", error instanceof Error ? error : new Error(String(error)));
        return new Response("Not Found", { status: 404 });
    }
};
