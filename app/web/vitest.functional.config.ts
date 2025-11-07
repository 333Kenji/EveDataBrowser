import { defineConfig } from 'vitest/config';
import baseConfig from './vite.config';

export default defineConfig({
  plugins: baseConfig.plugins,
  resolve: baseConfig.resolve,
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.functional.test.{ts,tsx}',
      'src/features/market-browser/**/*.{test,spec}.{ts,tsx}',
    ],
    setupFiles: ['src/test/setup.ts'],
  },
});
