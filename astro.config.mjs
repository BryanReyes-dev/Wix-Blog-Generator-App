// @ts-check
import { defineConfig } from 'astro/config';
import wix from '@wix/astro';
import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";

export default defineConfig({
  output: "server",
  adapter: wixHostingAdapter(),
  integrations: [wix(), react()],
  image: { domains: ["static.wixstatic.com"] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
  vite: {
    server: {
      cors: {
        // Wix serves the development site on its own origin while the local
        // widget calls this Vite/Astro server. Keep local origins and allow
        // only this development site's origin; do not enable CORS globally.
        origin: [
          /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
          'https://dev-sitex1487338744.wixdev-sites.org',
        ],
      },
    },
  },
});
