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

- **Frontend:** Next.js 14, React, Tailwind CSS
- **Database:** Supabase (PostgreSQL + pgvector)
- **Storage:** Supabase Storage (signed URLs)
- **Orchestrator:** Claude 3.5 Sonnet
- **Embeddings:** OpenAI text-embedding-3-small
- **Parsing:** LlamaCloud API (cloud-hosted LlamaParse)

## Component Registry

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `HeroBlock` | Opening headline & challenge | title, subtitle, challengeSummary |
| `StrategyCard` | Strategic insight cards | title, content, icon |
| `VideoPlayer` | Vimeo case study videos | url, caption |
| `MetricGrid` | KPI/stat displays (2-4 metrics) | stats[], columns, variant |
| `VisualAsset` | Images, charts, diagrams | src, alt, caption |
| `CaseStudyTeaser` | Links to full articles | title, summary, slug |

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

## Ingesting Content

### Single-Page Case Studies PDF

Article Group provides case studies as a single multi-page PDF (e.g., "AG single page case studies 2025.pdf") where each page is a separate case study. To handle this:

```bash
# 1. First, ingest the case studies to create database records
npm run ingest:split "./AG single page case studies 2025.pdf"

# 2. Then split the PDF and upload individual pages to Supabase Storage
npm run split:upload "./AG single page case studies 2025.pdf"
```

This two-step process:
1. **ingest:split** - Extracts text, creates embeddings, and stores metadata for each case study
2. **split:upload** - Splits the PDF into individual files and uploads them to Supabase Storage, then links the `pdf_url` to each case study record

The case study detail page (`/case-study/[slug]`) will automatically display the PDF when `pdf_url` is set.

### Single Document

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

### Batch Ingestion

```typescript
import { batchIngest } from '@/lib/ingestion';

await batchIngest([
  { filePath: '/docs/case1.pdf', options: { title: '...', slug: '...' } },
  { filePath: '/docs/case2.pdf', options: { title: '...', slug: '...' } },
], (completed, total, current) => {
  console.log(`Progress: ${completed}/${total} - ${current}`);
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
      { "component": "MetricGrid", "props": { "stats": [...] } }
    ]
  },
  "explanation": "Based on your interest...",
  "suggestedFollowUps": ["How do you approach...?"],
  "contactCTA": false
}
```

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

## Customization

### Adding Components

1. Create component in `src/components/`
2. Add type definitions in `src/types/index.ts`
3. Register in `src/components/index.ts`
4. Update orchestrator prompt in `src/lib/orchestrator.ts`

### Modifying Brand Styles

Edit CSS variables in `src/styles/design-system.css`:

```css
:root {
  --color-accent: #0A0A0A;
  --font-display: 'Your Font', serif;
  /* ... */
}
```

## Guardrails

The orchestrator enforces:

1. **No hallucination** - Only uses retrieved context
2. **Multimodal linkage** - Uses VisualAsset when image_url present
3. **Component-only output** - No raw HTML/CSS generation
4. **Fallback CTA** - Directs to Strategy Lead when no match

## Project Structure

```
article-group-concierge/
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts    # Chat endpoint
│   │   ├── globals.css          # Global styles
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Main UI
│   ├── components/
│   │   ├── HeroBlock.tsx
│   │   ├── StrategyCard.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── MetricGrid.tsx
│   │   ├── VisualAsset.tsx
│   │   ├── CaseStudyTeaser.tsx
│   │   ├── LayoutRenderer.tsx   # Assembly engine
│   │   └── index.ts             # Registry
│   ├── lib/
│   │   ├── supabase.ts          # DB client & RAG
│   │   ├── orchestrator.ts      # Claude integration
│   │   └── ingestion.ts         # Document pipeline
│   ├── styles/
│   │   └── design-system.css    # Brand variables
│   └── types/
│       └── index.ts             # TypeScript types
├── supabase/
│   └── schema.sql               # Database setup
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## License

Proprietary - Article Group

---

Built with Claude by Anthropic 🤖
