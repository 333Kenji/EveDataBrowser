import { defineConfig } from 'vitest/config';
import baseConfig from './vite.config';

// Root Vitest config consolidating component/logic tests while excluding Playwright e2e suites.
// Individual specialized configs (functional, a11y) remain available, but `npm run test:all`
// will now run with a jsdom environment and ignore tests/e2e Playwright suites.
export default defineConfig({
  plugins: baseConfig.plugins,
  resolve: baseConfig.resolve,
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
      // Allow colocated tests outside src if needed (but keep clear of e2e)
      'tests/**/*.{functional,a11y}.{test,spec}.{ts,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**',
      // Explicitly exclude raw Playwright spec patterns
      '**/tests/e2e/*.spec.{ts,tsx}'
    ],
    setupFiles: ['src/test/setup.ts']
  }
});
