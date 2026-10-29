// @ts-check
import { defineConfig } from 'astro/config';
import wix from '@wix/astro';
import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";
import { getAllowedDevCorsOrigins } from './src/lib/dev-cors.mjs';

// The Wix site/editor and the local app server have different origins while
// running `wix dev`. Allow known Wix-managed HTTPS origins, localhost, and
// any explicitly configured custom development origin. This is Vite dev-server
// CORS only; it does not configure the production hosting adapter.
const runtimeEnvironment = /** @type {typeof globalThis & { process?: { env?: Record<string, string | undefined> } }} */ (globalThis);
const allowedDevCorsOrigins = getAllowedDevCorsOrigins(runtimeEnvironment.process?.env?.WIX_DEV_CORS_ORIGINS);

export default defineConfig({
  output: "server",
  adapter: wixHostingAdapter(),
  integrations: [wix(), react()],
  image: { domains: ["static.wixstatic.com"] },
  devToolbar: { enabled: false },
  vite: {
    server: {
      cors: {
        origin: allowedDevCorsOrigins,
      },
    },
  },
});
