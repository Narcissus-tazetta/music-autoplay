import { createThemeAction } from "remix-themes";
import { themeSessionResolver } from "../../sessions.server";

export const action = createThemeAction(themeSessionResolver);
export default function SetTheme() {
  return null;
}
// これは action のみのルートです
// クライアント側のコンポーネントは不要です
