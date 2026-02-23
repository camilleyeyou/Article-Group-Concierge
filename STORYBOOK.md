# Storybook Setup Guide

Interactive component documentation and development environment.

## Installation

```bash
# Install Storybook and dependencies
npx storybook@latest init

# If prompted, select "nextjs" as your framework
```

## Running Storybook

```bash
# Start Storybook development server
npm run storybook

# Build static Storybook for deployment
npm run build-storybook
```

Storybook will be available at `http://localhost:6006`

## Configuration

- **`.storybook/main.ts`**: Main configuration, addons, framework settings
- **`.storybook/preview.ts`**: Preview configuration, global decorators, viewport settings

## Writing Stories

Stories are located alongside components with the `.stories.tsx` extension.

Example: `src/components/YourComponent.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { YourComponent } from './YourComponent';

const meta = {
  title: 'Components/YourComponent',
  component: YourComponent,
  tags: ['autodocs'],
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Your component props
  },
};
```

## Existing Stories

- **CaseStudyTeaser.stories.tsx**: Complete example with multiple variants

## Features Enabled

- ✅ TypeScript support
- ✅ Tailwind CSS styling
- ✅ Auto-generated documentation
- ✅ Interactive controls
- ✅ Accessibility testing (a11y addon)
- ✅ Responsive viewport testing
- ✅ Actions logging

## Best Practices

1. **Create stories for all reusable components**
2. **Test edge cases** (long content, empty states, error states)
3. **Document props** with descriptions and examples
4. **Use responsive viewports** to test mobile/tablet/desktop
5. **Add accessibility checks** for all components

## Deployment

Deploy Storybook to any static hosting:

```bash
npm run build-storybook
# Upload ./storybook-static to your hosting provider
```

Recommended hosts:
- Chromatic (official Storybook hosting)
- Vercel
- Netlify
- GitHub Pages
