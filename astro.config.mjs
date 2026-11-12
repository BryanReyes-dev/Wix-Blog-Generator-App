
import { defineConfig, envField } from 'astro/config';
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

  // Server-side environment configuration
  env: {
    schema: {
      CORS_ALLOWED_ORIGINS: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
    },
  },

  // Local development CORS
  vite: {
    server: {
      cors: {
        origin: 'https://dev-sitex1487338744.wixdev-sites.org',
      },
    },
  },
});
