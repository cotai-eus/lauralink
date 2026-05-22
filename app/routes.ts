import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("f/:id", "routes/download.tsx"),
] satisfies RouteConfig;
