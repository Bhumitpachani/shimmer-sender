import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    // autoCodeSplitting off on purpose: it makes each route a separately
    // hashed chunk, which 404s in any tab left open across a redeploy
    // (this SPA is small enough that one eager bundle is the safer trade).
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    react(),
    tailwindcss(),
    tsconfigPaths({ ignoreConfigErrors: true }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: ["**/.cache/**", "**/node_modules/**", "**/.local/**"],
    },
  },
});
