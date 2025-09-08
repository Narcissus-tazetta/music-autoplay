import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("action/set-theme", "routes/action/set-theme.server.tsx"),

  route("auth/login", "routes/auth/login.server.tsx"),
  route("auth/logout", "routes/auth/logout.server.tsx"),
  route("auth/google-callback", "routes/auth/google-callback.server.tsx"),

  route("api/music/add", "routes/api/music.add.server.tsx"),
  route("api/music/remove", "routes/api/music.remove.server.tsx"),

  route("*", "routes/not-found.tsx"),
  // route('time', 'routes/time.tsx'),
] satisfies RouteConfig;
