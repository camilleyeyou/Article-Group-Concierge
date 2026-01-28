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

    // Fetch related articles using the PostgreSQL function
    let relatedArticles: RelatedArticle[] = [];
    
    // Try capability-based matching first
    const { data: capArticles, error: capError } = await supabase
      .rpc('get_related_articles', {
        case_study_id: caseStudy.id,
        max_results: 5,
      });

    if (!capError && capArticles && capArticles.length > 0) {
      relatedArticles = capArticles;
    } else {
      // Fallback to embedding similarity
      const { data: simArticles } = await supabase
        .rpc('get_related_articles_by_similarity', {
          case_study_id: caseStudy.id,
          max_results: 5,
        });
      
      if (simArticles) {
        relatedArticles = simArticles.map((a: any) => ({
          ...a,
          relevance_score: a.similarity_score,
        }));
      }
    }

    // If still no articles, get any articles with thumbnails
    if (relatedArticles.length === 0) {
      const { data: anyArticles } = await supabase
        .from('documents')
        .select('id, title, slug, summary, thumbnail_url, pdf_url')
        .eq('doc_type', 'article')
        .not('thumbnail_url', 'is', null)
        .limit(5);
      
      if (anyArticles) {
        relatedArticles = anyArticles.map(a => ({
          ...a,
          relevance_score: 0,
        }));
      }
    }

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
