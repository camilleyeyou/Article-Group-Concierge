# Article Group AI Concierge

A RAG-powered pitch deck engine that assembles personalized "Lego-block" presentations using Claude as the layout orchestrator.

## Overview

This system transforms user queries into compelling, visually-driven pitch decks by:

1. **Retrieving** relevant case studies, insights, and visuals from a Supabase vector store
2. **Orchestrating** layouts using Claude 3.5 Sonnet
3. **Rendering** pre-built React components in a deterministic, branded layout

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Query                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Retrieval Layer                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   Hybrid    │  │   Visual     │  │    Taxonomy     │    │
│  │   Search    │  │   Assets     │  │    Filters      │    │
│  │ (pgvector)  │  │   Search     │  │                 │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Claude Orchestrator                        │
│              (Layout Plan Generation)                       │
│                                                             │
│  Input: User query + Retrieved context                      │
│  Output: JSON layout plan + Explanation                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   React Components                          │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐           │
│  │HeroBlock │ │StrategyCard  │ │  VideoPlayer  │           │
│  └──────────┘ └──────────────┘ └───────────────┘           │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐           │
│  │MetricGrid│ │ VisualAsset  │ │CaseStudyTeaser│           │
│  └──────────┘ └──────────────┘ └───────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS
- **Database:** Supabase (PostgreSQL + pgvector)
- **Storage:** Supabase Storage (signed URLs for images, PDFs, videos)
- **Orchestrator:** Claude 3.5 Sonnet (Anthropic SDK)
- **Embeddings:** OpenAI text-embedding-3-small
- **Parsing:** LlamaCloud API (cloud-hosted LlamaParse)
- **Monitoring:** Sentry (error tracking + performance)
- **Testing:** Playwright (E2E), Storybook (component dev)

## Component Registry

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `HeroBlock` | Opening headline & challenge | title, subtitle, challengeSummary |
| `StrategyCard` | Strategic insight cards | title, content, icon |
| `VideoPlayer` | Vimeo case study videos | url, caption |
| `MetricGrid` | KPI/stat displays (2-4 metrics) | stats[], columns, variant |
| `VisualAsset` | Images, charts, diagrams | src, alt, caption |
| `CaseStudyTeaser` | Links to full case study articles | title, summary, slug |

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Anthropic API key (for Claude orchestrator)
- OpenAI API key (for embeddings)
- LlamaCloud API key (for document parsing) - get at https://cloud.llamaindex.ai

### Installation

```bash
# Clone and install
cd article-group-concierge
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run database migrations
# (Copy contents of supabase/schema.sql to Supabase SQL editor)

# Start development server
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
OPENAI_API_KEY=sk-xxxxx
LLAMA_CLOUD_API_KEY=llx-xxxxx
```

## Content Ingestion

### Single-Page Case Studies PDF

Article Group provides case studies as a single multi-page PDF where each page is a separate case study:

```bash
# 1. Ingest case studies to create database records
npm run ingest:split "./AG single page case studies 2025.pdf"

# 2. Split the PDF and upload individual pages to Supabase Storage
npm run split:upload "./AG single page case studies 2025.pdf"
```

### Other Ingestion Scripts

```bash
npm run ingest              # General ingestion
npm run ingest:single       # Single document
npm run ingest:batch        # Batch processing
npm run ingest:articles     # Article content
npm run ingest:images       # Image assets
npm run upload:pdfs         # Upload PDFs to storage
npm run upload:videos       # Upload videos to storage
npm run populate            # Populate case study records
npm run generate:thumbnails # Generate video thumbnails
```

### Programmatic Ingestion

```typescript
import { ingestDocument } from '@/lib/ingestion';

await ingestDocument('/path/to/case-study.pdf', {
  title: 'NeoBank Rebrand',
  slug: 'neobank-rebrand',
  clientName: 'NeoBank',
  summary: 'A complete brand transformation...',
  vimeoUrl: 'https://vimeo.com/123456789',
  capabilitySlugs: ['brand-strategy', 'creative-direction'],
  industrySlugs: ['finance'],
});
```

## API Reference

### POST /api/chat

Query the concierge for a personalized pitch deck.

**Request:**
```json
{
  "query": "We're a fintech startup looking to rebrand...",
  "filters": {
    "capabilities": ["brand-strategy"],
    "industries": ["finance"]
  },
  "conversationHistory": []
}
```

**Response:**
```json
{
  "layoutPlan": {
    "layout": [
      { "component": "HeroBlock", "props": { "title": "..." } },
      { "component": "MetricGrid", "props": { "stats": [] } }
    ]
  },
  "explanation": "Based on your interest...",
  "suggestedFollowUps": ["How do you approach...?"],
  "contactCTA": false
}
```

### GET /api/health

Health check endpoint returning system status.

### GET /api/analytics

Analytics data endpoint for tracking usage.

### GET /api/case-study/[slug]

Retrieve full case study data by slug.

### GET /api/article/[slug]

Retrieve article content by slug.

## Database Schema

### Core Tables

- `case_studies` - Parent records for portfolio items
- `content_chunks` - RAG chunks with embeddings
- `visual_assets` - Images/charts from documents
- `case_study_metrics` - Extracted KPIs

### Taxonomy Tables

- `capabilities` - Service offerings (Brand Strategy, etc.)
- `industries` - Target verticals (Finance, Tech, etc.)
- `case_study_capabilities` - M:M junction
- `case_study_industries` - M:M junction

### Key Functions

- `hybrid_search()` - Combined semantic + keyword search
- `search_visual_assets()` - Image/chart retrieval

## Testing

### E2E Tests (Playwright)

```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Run with Playwright UI
```

### Component Development (Storybook)

```bash
npm run storybook         # Start Storybook dev server on port 6006
npm run build-storybook   # Build static Storybook
```

### User Testing

We provide structured user testing materials for validating the AI Concierge with real users:

- **[USER-TESTING-SCRIPT.md](USER-TESTING-SCRIPT.md)** - Complete facilitator guide with 9 test scenarios
- **[TEST-SESSION-CHECKLIST.md](TEST-SESSION-CHECKLIST.md)** - Quick session tracker and checklist
- **[TESTER-README.md](TESTER-README.md)** - Instructions to send to test participants
- **[PARTICIPANT-RECRUITMENT-EMAIL.md](PARTICIPANT-RECRUITMENT-EMAIL.md)** - Email templates for recruiting testers

## Project Structure

```
article-group-concierge/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts         # Chat endpoint
│   │   │   ├── health/route.ts       # Health check
│   │   │   ├── analytics/route.ts    # Analytics
│   │   │   ├── case-study/[slug]/    # Case study API
│   │   │   └── article/[slug]/       # Article API
│   │   ├── article/[slug]/page.tsx   # Article pages
│   │   ├── case-study/[slug]/page.tsx# Case study pages
│   │   ├── contact/page.tsx          # Contact page
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Main concierge UI
│   │   ├── error.tsx                 # Error boundary page
│   │   └── global-error.tsx          # Global error handler
│   ├── components/
│   │   ├── HeroBlock.tsx
│   │   ├── StrategyCard.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── MetricGrid.tsx
│   │   ├── VisualAsset.tsx
│   │   ├── CaseStudyTeaser.tsx
│   │   ├── LayoutRenderer.tsx        # Assembly engine
│   │   ├── ErrorBoundary.tsx         # React error boundary
│   │   └── index.ts                  # Component registry
│   ├── lib/
│   │   ├── supabase.ts               # DB client & RAG queries
│   │   ├── orchestrator.ts           # Claude integration
│   │   ├── ingestion.ts              # Document pipeline
│   │   ├── cache.ts                  # Response caching
│   │   ├── rate-limit.ts             # API rate limiting
│   │   ├── analytics.ts              # Usage analytics
│   │   ├── ab-testing.ts             # A/B testing
│   │   ├── performance.ts            # Performance monitoring
│   │   ├── logger.ts                 # Structured logging
│   │   ├── sentry.ts                 # Sentry integration
│   │   ├── admin-auth.ts             # Admin authentication
│   │   └── supabase-image-loader.ts  # Next.js image loader
│   ├── types/
│   │   └── index.ts                  # TypeScript types
│   └── instrumentation.ts            # Sentry instrumentation
├── scripts/                           # Ingestion & upload scripts
├── content/                           # Source content
│   ├── Articles/
│   ├── case-studies/
│   ├── images/
│   └── videos/
├── tests/
│   └── e2e/                           # Playwright E2E tests
├── supabase/
│   ├── schema.sql                     # Database setup
│   └── migrations/                    # DB migrations
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── playwright.config.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Customization

### Adding Components

1. Create component in `src/components/`
2. Add type definitions in `src/types/index.ts`
3. Register in `src/components/index.ts`
4. Update orchestrator prompt in `src/lib/orchestrator.ts`

### Modifying Brand Styles

Edit CSS variables in `src/app/globals.css`:

```css
:root {
  --color-accent: #32373c;  /* Dark charcoal */
  /* Accent colors: coral (#fc5d4c), teal (#47ddb2), blue (#0d72d1) */
}
```

## Guardrails

The orchestrator enforces:

1. **No hallucination** - Only uses retrieved context
2. **Multimodal linkage** - Uses VisualAsset when image_url present
3. **Component-only output** - No raw HTML/CSS generation
4. **Fallback CTA** - Directs to Strategy Lead when no match

## Key Commands

```bash
npm run dev               # Start dev server
npm run build             # Production build
npm run start             # Start production server
npm run lint              # Run ESLint
npm run type-check        # TypeScript type checking
npm run test:e2e          # Run Playwright tests
npm run storybook         # Component development
```

## License

Proprietary - Article Group
