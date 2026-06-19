import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    // Resolves "@/*" path aliases from tsconfig.json
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    // TanStack Start — handles SSR, server functions, file-based routing
    tanstackStart({
      srcDirectory: "src",
    }),
    // Nitro — builds server output Vercel can run (auto-detects Vercel env)
    nitro(),
    viteReact(),
  ],
});
