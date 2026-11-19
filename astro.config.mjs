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

  // During local development, the Wix preview page calls this API at
  // localhost:4321. Vite's default CORS policy only permits localhost
  // origins, so allow Wix development-site preview hosts here.
  // This Vite dev-server setting is not part of the deployed app.
  vite: {
    server: {
      cors: {
        origin: /^https:\/\/[a-z0-9-]+\.wixdev-sites\.org$/i,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Wix-Linguist'],
      },
    },
  },
});
