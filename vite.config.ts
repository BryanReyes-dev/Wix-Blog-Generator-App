import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    clearMocks: true,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});