import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  thumbnail_url: string | null;
  pdf_url: string | null;
  relevance_score?: number;
}

interface SupportVideo {
  id: string;
  video_url: string;
  title: string | null;
  description: string | null;
  display_order: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const supabase = getSupabase();

  try {
    // First try exact match
    let { data: caseStudy, error: caseStudyError } = await supabase
      .from('documents')
      .select('*')
      .eq('slug', slug)
      .single();

    // If not found, try partial match (slug starts with the provided slug)
    if (caseStudyError || !caseStudy) {
      const { data: partialMatches } = await supabase
        .from('documents')
        .select('*')
        .ilike('slug', `${slug}%`)
        .limit(1);
      
      if (partialMatches && partialMatches.length > 0) {
        caseStudy = partialMatches[0];
      }
    }

    // If still not found, try matching by searching within the slug
    if (!caseStudy) {
      // Split the search slug into parts and look for matches
      const slugParts = slug.split('-').filter(p => p.length > 2);
      if (slugParts.length >= 2) {
        const searchPattern = `%${slugParts.slice(0, 3).join('%')}%`;
        const { data: fuzzyMatches } = await supabase
          .from('documents')
          .select('*')
          .ilike('slug', searchPattern)
          .eq('doc_type', 'case_study')
          .limit(1);
        
        if (fuzzyMatches && fuzzyMatches.length > 0) {
          caseStudy = fuzzyMatches[0];
        }
      }
    }

    if (!caseStudy) {
      return NextResponse.json(
        { error: 'Case study not found' },
        { status: 404 }
      );
    }

    // Fetch content chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('content_chunks')
      .select('id, content, chunk_index, chunk_type')
      .eq('document_id', caseStudy.id)
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
    }

    // Fetch capabilities
    const { data: capabilityLinks } = await supabase
      .from('document_capabilities')
      .select('capability_id')
      .eq('document_id', caseStudy.id);

    let capabilities: Array<{ name: string; slug: string }> = [];
    if (capabilityLinks && capabilityLinks.length > 0) {
      const ids = capabilityLinks.map(c => c.capability_id);
      const { data: caps } = await supabase
        .from('capabilities')
        .select('name, slug')
        .in('id', ids);
      capabilities = caps || [];
    }

    // Fetch industries
    const { data: industryLinks } = await supabase
      .from('document_industries')
      .select('industry_id')
      .eq('document_id', caseStudy.id);

    let industries: Array<{ name: string; slug: string }> = [];
    if (industryLinks && industryLinks.length > 0) {
      const ids = industryLinks.map(i => i.industry_id);
      const { data: inds } = await supabase
        .from('industries')
        .select('name, slug')
        .in('id', ids);
      industries = inds || [];
    }

    // Fetch visual assets
    const { data: assets } = await supabase
      .from('visual_assets')
      .select('*')
      .eq('document_id', caseStudy.id);

    // Fetch metrics
    const { data: metrics } = await supabase
      .from('document_metrics')
      .select('*')
      .eq('document_id', caseStudy.id)
      .order('display_order', { ascending: true });

    // Fetch support videos
    let supportVideos: SupportVideo[] = [];
    const { data: videos } = await supabase
      .from('support_videos')
      .select('id, video_url, title, description, display_order')
      .eq('document_id', caseStudy.id)
      .order('display_order', { ascending: true });
    
    if (videos) {
      supportVideos = videos;
    }

    // Fetch related articles - use multiple strategies
    let relatedArticles: RelatedArticle[] = [];
    
    // Strategy 1: Try the PostgreSQL function first
    try {
      const { data: capArticles, error: capError } = await supabase
        .rpc('get_related_articles', {
          case_study_id: caseStudy.id,
          max_results: 6,
        });

      if (!capError && capArticles && capArticles.length > 0) {
        relatedArticles = capArticles;
      }
    } catch (e) {
      console.log('get_related_articles function not available');
    }
    
    // Strategy 2: Keyword-based search using case study title/client
    if (relatedArticles.length < 3) {
      // Extract keywords from case study
      const keywords = [
        caseStudy.client_name,
        ...caseStudy.title.split(/[:\-–—]/)[0].split(' ').filter((w: string) => w.length > 3),
        ...capabilities.map(c => c.name),
      ].filter(Boolean).slice(0, 5);
      
      // Search for articles with matching keywords
      const searchPattern = keywords.map(k => `%${k}%`).join('|');
      
      const { data: keywordArticles } = await supabase
        .from('documents')
        .select('id, title, slug, summary, thumbnail_url, pdf_url')
        .eq('doc_type', 'article')
        .or(keywords.map(k => `title.ilike.%${k}%`).join(','))
        .limit(6);
      
      if (keywordArticles && keywordArticles.length > 0) {
        // Merge without duplicates
        const existingIds = new Set(relatedArticles.map(a => a.id));
        for (const article of keywordArticles) {
          if (!existingIds.has(article.id)) {
            relatedArticles.push({ ...article, relevance_score: 0.5 });
          }
        }
      }
    }

    // Strategy 3: Get random articles if still not enough
    if (relatedArticles.length < 3) {
      const { data: randomArticles } = await supabase
        .from('documents')
        .select('id, title, slug, summary, thumbnail_url, pdf_url')
        .eq('doc_type', 'article')
        .not('thumbnail_url', 'is', null)
        .limit(6);
      
      if (randomArticles) {
        const existingIds = new Set(relatedArticles.map(a => a.id));
        for (const article of randomArticles) {
          if (!existingIds.has(article.id) && relatedArticles.length < 6) {
            relatedArticles.push({ ...article, relevance_score: 0.1 });
          }
        }
      }
    }
    
    // Limit to 6 articles
    relatedArticles = relatedArticles.slice(0, 6);

    const response = NextResponse.json({
      caseStudy,
      chunks: chunks || [],
      capabilities,
      industries,
      assets: assets || [],
      metrics: metrics || [],
      supportVideos,
      relatedArticles,
    });
    
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    
    return response;

  } catch (error) {
    console.error('Error fetching case study:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
