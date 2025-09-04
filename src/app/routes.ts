import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("time", "routes/time.tsx"),
  route("api/assets", "routes/api/assets.tsx"),
] satisfies RouteConfig;
