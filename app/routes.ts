import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("upload", "routes/upload.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("file/:id", "routes/file.$id.tsx"),
] satisfies RouteConfig;
