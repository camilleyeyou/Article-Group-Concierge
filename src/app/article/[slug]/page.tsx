'use client';

/**
 * Article Detail Page
 * 
 * Displays Article Group articles (thought leadership, newsletters, etc.)
 * Similar structure to case study but simpler - just PDF viewer.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  pdf_url: string | null;
  thumbnail_url: string | null;
  author: string | null;
  published_date: string | null;
}

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const response = await fetch(`/api/article/${slug}`);
        if (!response.ok) throw new Error('Article not found');
        const data = await response.json();
        setArticle(data.article);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchArticle();
  }, [slug]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1818] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#333] border-t-[#F96A63] rounded-full animate-spin" />
          <p className="text-white/60 font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Loading article...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#1A1818] flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-3xl text-white mb-4" style={{ fontFamily: 'Lora, serif' }}>
            Article Not Found
          </h1>
          <p className="text-white/60 mb-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
            We couldn't find the article you're looking for.
          </p>
          <button 
            onClick={() => router.back()} 
            className="px-8 py-3 bg-[#F96A63] text-white rounded-full font-medium hover:bg-[#e85a53] transition-colors"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Clean title (remove underscores)
  const cleanTitle = article.title.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-[#1A1818]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1A1818]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-16">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back</span>
            </button>
            
            <Link href="/" className="text-xl text-white" style={{ fontFamily: 'Lora, serif' }}>
              Article Group
            </Link>
            
            <Link
              href="/contact"
              className="px-6 py-2.5 bg-[#F96A63] text-white text-sm font-medium rounded-full hover:bg-[#e85a53] transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 pb-8 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          {/* Article badge */}
          <div className="mb-4">
            <span 
              className="inline-block px-4 py-1.5 bg-[#0097A7]/20 text-[#4DD0E1] text-sm font-medium rounded-full"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Article
            </span>
          </div>
          
          {/* Title */}
          <h1 
            className="text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-4"
            style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
          >
            {cleanTitle}
          </h1>

          {/* Meta */}
          {(article.author || article.published_date) && (
            <div className="flex items-center gap-4 text-white/50" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {article.author && <span>By {article.author}</span>}
              {article.published_date && (
                <span>{new Date(article.published_date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              )}
            </div>
          )}

          {/* Summary */}
          {article.summary && (
            <p 
              className="text-lg text-white/60 mt-6 max-w-3xl"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {article.summary}
            </p>
          )}
        </div>
      </section>

      {/* PDF Viewer */}
      <section className="px-6 lg:px-12 pb-16">
        <div className="max-w-5xl mx-auto">
          {article.pdf_url ? (
            <div className="relative bg-white rounded-xl overflow-hidden shadow-2xl">
              {/* PDF Loading indicator */}
              {pdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-[#EEEEEE] border-t-[#F96A63] rounded-full animate-spin" />
                    <p className="text-[#595959]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Loading document...
                    </p>
                  </div>
                </div>
              )}
              
              {/* PDF Embed */}
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(article.pdf_url)}&embedded=true`}
                className="w-full"
                style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
                onLoad={() => setPdfLoading(false)}
                title={article.title}
                frameBorder="0"
              />
              
              {/* Download button */}
              <div className="absolute top-4 right-4 z-20">
                <a
                  href={article.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-black transition-colors shadow-lg"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl text-white mb-3" style={{ fontFamily: 'Lora, serif' }}>
                PDF Coming Soon
              </h3>
              <p className="text-white/60 max-w-md mx-auto" style={{ fontFamily: 'Poppins, sans-serif' }}>
                The document for this article is being prepared.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A1818] border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link 
              href="/" 
              className="text-lg text-white"
              style={{ fontFamily: 'Lora, serif' }}
            >
              Article Group
            </Link>
            
            <p 
              className="text-white/30 text-sm"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              © {new Date().getFullYear()} Article Group
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
