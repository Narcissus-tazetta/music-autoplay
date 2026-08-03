import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
    index('routes/home.tsx'),
    route('action/set-theme', 'routes/action/set-theme.tsx'),

    route('auth/login', 'routes/auth/login.tsx'),
    route('auth/logout', 'routes/auth/logout.tsx'),
    route('auth/google-callback', 'routes/auth/google-callback.tsx'),
    route('admin', 'routes/admin.tsx'),

    route('api/music/add', 'routes/api/music.add.ts'),
    route('api/music/remove', 'routes/api/music.remove.ts'),
    route('api/music/reorder', 'routes/api/music.reorder.ts'),
    route('api/requester/name', 'routes/api/requester.name.ts'),
    route('api/search/furigana', 'routes/api/search.furigana.ts'),
    route('api/assets', 'routes/api/assets.ts'),
    route('api/settings', 'routes/api/settings.ts'),

    route('*', 'routes/not-found.tsx'),
    // route('time', 'routes/time.tsx'),
] satisfies RouteConfig;
