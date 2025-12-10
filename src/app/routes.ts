import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
    index('routes/home.tsx'),
    route('action/set-theme', 'routes/action/set-theme.tsx'),

    route('auth/login', 'routes/auth/login.tsx'),
    route('auth/logout', 'routes/auth/logout.tsx'),
    route('auth/google-callback', 'routes/auth/google-callback.tsx'),
    route('admin', 'routes/admin.tsx'),

    route('api/music/add', 'routes/api/music.add.tsx'),
    route('api/music/remove', 'routes/api/music.remove.tsx'),
    route('api/assets', 'routes/api/assets.tsx'),
    route('api/settings', 'routes/api/settings.tsx'),

    route('*', 'routes/not-found.tsx'),
    // route('time', 'routes/time.tsx'),
] satisfies RouteConfig;
