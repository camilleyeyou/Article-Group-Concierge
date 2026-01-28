import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const supabase = getSupabase();

  try {
    // First try exact match
    let { data: article, error: articleError } = await supabase
      .from('documents')
      .select('*')
      .eq('slug', slug)
      .eq('doc_type', 'article')
      .single();

    // If not found, try partial match
    if (articleError || !article) {
      const { data: partialMatches } = await supabase
        .from('documents')
        .select('*')
        .eq('doc_type', 'article')
        .ilike('slug', `${slug}%`)
        .limit(1);
      
      if (partialMatches && partialMatches.length > 0) {
        article = partialMatches[0];
      }
    }

    // If still not found, try fuzzy match
    if (!article) {
      const slugParts = slug.split('-').filter(p => p.length > 2);
      if (slugParts.length >= 2) {
        const searchPattern = `%${slugParts.slice(0, 3).join('%')}%`;
        const { data: fuzzyMatches } = await supabase
          .from('documents')
          .select('*')
          .eq('doc_type', 'article')
          .ilike('slug', searchPattern)
          .limit(1);
        
        if (fuzzyMatches && fuzzyMatches.length > 0) {
          article = fuzzyMatches[0];
        }
      }
    }

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Fetch topics
    const { data: topicLinks } = await supabase
      .from('document_topics')
      .select('topic_id')
      .eq('document_id', article.id);

    let topics: Array<{ name: string; slug: string }> = [];
    if (topicLinks && topicLinks.length > 0) {
      const ids = topicLinks.map(t => t.topic_id);
      const { data: topicData } = await supabase
        .from('topics')
        .select('name, slug')
        .in('id', ids);
      topics = topicData || [];
    }

    const response = NextResponse.json({
      article,
      topics,
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    
    return response;

  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
