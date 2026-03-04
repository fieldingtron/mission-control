import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import alpinejs from '@astrojs/alpinejs';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [alpinejs()],

  server: {
    host: true,
  },

  security: {
    checkOrigin: false
  },

  vite: {
    plugins: [tailwindcss()]
  }
});