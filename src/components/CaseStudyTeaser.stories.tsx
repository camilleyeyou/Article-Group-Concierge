import type { Meta, StoryObj } from '@storybook/react';
import { CaseStudyTeaser } from './CaseStudyTeaser';

/**
 * CaseStudyTeaser Stories
 *
 * Interactive documentation and testing for the CaseStudyTeaser component.
 * Tests various states, props, and responsive behavior.
 */

const meta = {
  title: 'Components/CaseStudyTeaser',
  component: CaseStudyTeaser,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A preview card for case studies matching articlegroup.com/work style. Features image-dominant tiles with clean typography and elegant hover effects.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Case study title (can include client name as "Client: Title")',
    },
    clientName: {
      control: 'text',
      description: 'Client name (optional if included in title)',
    },
    summary: {
      control: 'text',
      description: 'Brief description of the project',
    },
    capabilities: {
      control: 'object',
      description: 'Array of capability tags',
    },
    industries: {
      control: 'object',
      description: 'Array of industry tags',
    },
    slug: {
      control: 'text',
      description: 'URL slug for linking to full case study',
    },
  },
} satisfies Meta<typeof CaseStudyTeaser>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default story with all fields populated
 */
export const Default: Story = {
  args: {
    title: 'Acme Corp: Brand Transformation',
    clientName: 'Acme Corp',
    summary:
      'A comprehensive rebrand that elevated Acme Corp from a traditional manufacturing company to a modern technology leader.',
    capabilities: ['Brand Strategy', 'Creative Direction', 'Content Strategy'],
    industries: ['Technology', 'Manufacturing'],
    slug: 'acme-corp-brand-transformation',
  },
};

/**
 * Story with title that includes client name
 */
export const TitleWithClient: Story = {
  args: {
    title: 'Acme Corp: Digital Platform Launch',
    summary:
      'End-to-end design and development of a customer-facing digital platform.',
    capabilities: ['Web Development', 'UX Design'],
    industries: ['Technology'],
    slug: 'acme-corp-platform',
  },
};

/**
 * Minimal story with only required fields
 */
export const Minimal: Story = {
  args: {
    title: 'Startup Growth Campaign',
    capabilities: ['Digital Marketing'],
    industries: ['Technology'],
  },
};

/**
 * Story with long content to test text overflow
 */
export const LongContent: Story = {
  args: {
    title: 'Global Enterprise: Comprehensive Digital Transformation Initiative',
    clientName: 'Global Enterprise Solutions International Corporation',
    summary:
      'A multi-year, comprehensive digital transformation initiative spanning brand strategy, platform development, content creation, and organizational change management across 15 countries and 50+ markets.',
    capabilities: [
      'Brand Strategy',
      'Digital Transformation',
      'Content Strategy',
      'Change Management',
    ],
    industries: ['Enterprise Software', 'Consulting', 'Technology'],
    slug: 'global-enterprise-transformation',
  },
};

/**
 * Story with single capability and industry
 */
export const SingleTag: Story = {
  args: {
    title: 'Boutique Hotel: Social Media Strategy',
    clientName: 'Boutique Hotel',
    summary: 'A focused social media strategy to increase bookings and brand awareness.',
    capabilities: ['Social Media'],
    industries: ['Hospitality'],
    slug: 'boutique-hotel-social',
  },
};

/**
 * Story without slug (non-clickable)
 */
export const WithoutLink: Story = {
  args: {
    title: 'Example Project',
    summary: 'This card has no slug, so it is not clickable.',
    capabilities: ['Brand Strategy'],
    industries: ['Technology'],
  },
};

/**
 * Grid layout demonstration
 */
export const GridLayout: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <CaseStudyTeaser
        title="Project One"
        summary="First case study in a grid layout."
        capabilities={['Brand Strategy']}
        industries={['Technology']}
        slug="project-one"
      />
      <CaseStudyTeaser
        title="Project Two"
        summary="Second case study demonstrating grid responsiveness."
        capabilities={['Creative Direction']}
        industries={['Finance']}
        slug="project-two"
      />
      <CaseStudyTeaser
        title="Project Three"
        summary="Third case study completing the row."
        capabilities={['Web Development']}
        industries={['Healthcare']}
        slug="project-three"
      />
    </div>
  ),
};
