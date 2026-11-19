import { defineConfig } from "vite-plus";

export default defineConfig({
  // Astro's base tsconfig preserves JSX for the server build. The standalone
  // Vite test runner needs to transform imported React components.
  // Vite+ uses Oxc for JSX transforms; configure React's automatic runtime here.
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    clearMocks: true,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});