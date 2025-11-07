import { defineConfig } from 'vitest/config';
import baseConfig from './vite.config';

export default defineConfig({
  plugins: baseConfig.plugins,
  resolve: baseConfig.resolve,
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.a11y.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
