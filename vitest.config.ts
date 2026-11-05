import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        esbuild: {
          jsx: 'automatic',
        },
        test: {
          name: 'unit',
          environment: 'jsdom',
          // Node 26's experimental global localStorage shadows jsdom's Storage
          // implementation unless it is disabled for the test workers.
          execArgv: ['--no-experimental-webstorage'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.browser.test.tsx', '**/node_modules/**'],
          setupFiles: ['src/test/setup.ts'],
        },
        resolve: {
          alias: {
            '@': path.join(dirname, 'src'),
          },
        },
      },
      {
        // Plain component tests in real Chromium: real layout, hit-testing
        // and CDP input, which jsdom cannot model (run by `test:visual`).
        extends: true,
        esbuild: {
          jsx: 'automatic',
        },
        define: {
          'process.env': '{}',
        },
        resolve: {
          alias: {
            '@': path.join(dirname, 'src'),
          },
        },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              { browser: 'chromium', viewport: { width: 1280, height: 900 } },
            ],
          },
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});
