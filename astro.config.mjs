import { defineConfig } from 'astro/config';
import wix from '@wix/astro';
import react from '@astrojs/react';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';

export default defineConfig({
  output: 'server',
  adapter: wixHostingAdapter(),
  integrations: [wix(), react()],
  image: { domains: ['static.wixstatic.com'] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },

  // The Wix-hosted preview calls the local Astro API at localhost:4321.
  // Vite's default dev CORS policy only permits localhost origins, not the
  // Wix preview origin, so explicitly allow this development site.
  // This is a Vite dev-server setting; it does not add production CORS.
  vite: {
    server: {
      cors: {
        origin: 'https://dev-sitex1487338744.wixdev-sites.org',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Wix-Linguist'],
      },
    },
  },
});
