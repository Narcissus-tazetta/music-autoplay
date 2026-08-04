import { themeSessionResolver } from '@/server/sessions.server';
import { createThemeAction } from 'remix-themes';

export const action = createThemeAction(themeSessionResolver);
export default function SetTheme() {
    return;
}
// これは action のみのルートです
// クライアント側のコンポーネントは不要です
