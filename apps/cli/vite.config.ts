import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  plugins: [
    devtools(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  ssr: {
    // These packages will be bundled instead of externalized
    noExternal: ["@bullstudio/ui", /^@radix-ui\//],
    // External packages for SSR - use native require
    external: ["react", "react-dom"],
    // Allow CJS modules in SSR
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    esbuildOptions: {
      // Handle CommonJS modules
      format: "esm",
    },
  },
});

export default config;
