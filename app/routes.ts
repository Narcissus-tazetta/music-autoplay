import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/assets", "routes/api/assets.tsx"),
] satisfies RouteConfig;
