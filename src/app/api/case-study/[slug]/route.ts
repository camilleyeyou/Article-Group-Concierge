import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

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
          .eq('document_type', 'case_study')
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
      .select('id, content, chunk_index')
      .eq('document_id', caseStudy.id)
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
    }

    // Fetch capabilities
    const { data: capabilityLinks } = await supabase
      .from('document_capabilities')
      .select('capability_slug')
      .eq('document_id', caseStudy.id);

    let capabilities: Array<{ name: string; slug: string }> = [];
    if (capabilityLinks && capabilityLinks.length > 0) {
      const slugs = capabilityLinks.map(c => c.capability_slug);
      const { data: caps } = await supabase
        .from('capabilities')
        .select('name, slug')
        .in('slug', slugs);
      capabilities = caps || [];
    }

    // Fetch industries
    const { data: industryLinks } = await supabase
      .from('document_industries')
      .select('industry_slug')
      .eq('document_id', caseStudy.id);

    let industries: Array<{ name: string; slug: string }> = [];
    if (industryLinks && industryLinks.length > 0) {
      const slugs = industryLinks.map(i => i.industry_slug);
      const { data: inds } = await supabase
        .from('industries')
        .select('name, slug')
        .in('slug', slugs);
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

    return NextResponse.json({
      caseStudy,
      chunks: chunks || [],
      capabilities,
      industries,
      assets: assets || [],
      metrics: metrics || [],
    });

  } catch (error) {
    console.error('Error fetching case study:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
