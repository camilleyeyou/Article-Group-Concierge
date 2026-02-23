import type { StorybookConfig } from '@storybook/nextjs';

/**
 * Storybook Configuration
 *
 * To install Storybook:
 * npx storybook@latest init
 *
 * This configuration is optimized for Next.js 14 with:
 * - TypeScript support
 * - Tailwind CSS styling
 * - Component documentation
 * - Interactive controls
 */

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-onboarding',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y', // Accessibility testing
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'],
};

export default config;
