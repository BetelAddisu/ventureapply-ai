import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Deploy to Vercel serverless functions
  server: {
    preset: "vercel",
  },
  vite: {
    plugins: [
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },
  tsr: {
    // Auto-detect routes in src/routes
    appDirectory: "src",
    routesDirectory: "src/routes",
    generatedRouteTree: "src/routeTree.gen.ts",
  },
});
