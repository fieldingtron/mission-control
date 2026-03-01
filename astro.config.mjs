import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import alpinejs from '@astrojs/alpinejs';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [alpinejs()],
  server: {
    host: true,
  }
});
