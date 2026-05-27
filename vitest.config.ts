import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      globals: true,
      include: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.contract.test.ts",
        "src/**/*.contract.test.tsx",
        "tests/**/*.spec.ts",
        "tests/**/*.spec.tsx",
      ],
    },
  })
);
