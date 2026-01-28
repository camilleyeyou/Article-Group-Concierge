'use client';

/**
 * Case Study Detail Page - PDF-First Design
 * 
 * Three sections:
 * 1. Hero Section - Video background or gradient with title
 * 2. Document Section - Full PDF embed
 * 3. Knowledge Base - Related articles and support videos
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface CaseStudy {
  id: string;
  title: string;
  client_name: string;
  slug: string;
  summary: string;
  pdf_url: string | null;
  thumbnail_url: string | null;
  hero_video_url: string | null;
  vimeo_url: string | null;
}

interface Capability {
  name: string;
  slug: string;
}

interface Industry {
  name: string;
  slug: string;
}

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  thumbnail_url: string | null;
  pdf_url: string | null;
}

interface SupportVideo {
  id: string;
  video_url: string;
  title: string | null;
  description: string | null;
}

export default function CaseStudyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [supportVideos, setSupportVideos] = useState<SupportVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  useEffect(() => {
    async function fetchCaseStudy() {
      try {
        const response = await fetch(`/api/case-study/${slug}`);
        if (!response.ok) throw new Error('Case study not found');
        const data = await response.json();
        setCaseStudy(data.caseStudy);
        setCapabilities(data.capabilities || []);
        setIndustries(data.industries || []);
        setRelatedArticles(data.relatedArticles || []);
        setSupportVideos(data.supportVideos || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchCaseStudy();
  }, [slug]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1818] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#333] border-t-[#F96A63] rounded-full animate-spin" />
          <p className="text-white/60 font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Loading case study...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-[#1A1818] flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-3xl text-white mb-4" style={{ fontFamily: 'Lora, serif' }}>
            Case Study Not Found
          </h1>
          <p className="text-white/60 mb-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
            We couldn't find the case study you're looking for.
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

  // Parse title
  const titleParts = caseStudy.title.split(':');
  const clientName = titleParts.length > 1 ? titleParts[0].trim() : caseStudy.client_name;
  const projectTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : caseStudy.title;

  // Check for hero video (prefer hero_video_url, fallback to vimeo_url for MP4)
  const heroVideoUrl = caseStudy.hero_video_url || 
    (caseStudy.vimeo_url?.includes('.mp4') ? caseStudy.vimeo_url : null);

  return (
    <div className="min-h-screen bg-[#1A1818]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1A1818]/80 backdrop-blur-md border-b border-white/10">
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

      {/* ============================================ */}
      {/* SECTION 1: HERO */}
      {/* ============================================ */}
      <section className="relative h-[70vh] min-h-[500px] flex items-end overflow-hidden">
        {/* Background: Video or Gradient */}
        {heroVideoUrl ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src={heroVideoUrl} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1818] via-[#1A1818]/50 to-transparent" />
          </>
        ) : (
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #1A1818 0%, #2D2A2A 50%, #1A1818 100%)',
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-20 right-20 w-64 h-64 bg-[#F96A63]/10 rounded-full blur-3xl" />
            <div className="absolute bottom-40 left-10 w-96 h-96 bg-[#0097A7]/10 rounded-full blur-3xl" />
          </div>
        )}

        {/* Content Overlay */}
        <div className="relative z-10 w-full pb-16 pt-32 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            {/* Client badge */}
            {clientName && (
              <div className="mb-4">
                <span 
                  className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-sm text-white/90 text-sm font-medium rounded-full border border-white/20"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {clientName}
                </span>
              </div>
            )}
            
            {/* Title */}
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl text-white leading-tight max-w-4xl mb-6"
              style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
            >
              {projectTitle}
            </h1>
            
            {/* Tags */}
            {(capabilities.length > 0 || industries.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {capabilities.map((cap, i) => (
                  <span 
                    key={i} 
                    className="px-3 py-1.5 text-sm bg-[#0097A7]/30 text-[#4DD0E1] rounded-full backdrop-blur-sm"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {cap.name}
                  </span>
                ))}
                {industries.map((ind, i) => (
                  <span 
                    key={i} 
                    className="px-3 py-1.5 text-sm bg-white/10 text-white/70 rounded-full backdrop-blur-sm"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {ind.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="flex flex-col items-center gap-2 text-white/40">
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Scroll to explore
            </span>
            <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 2: DOCUMENT (PDF) */}
      {/* ============================================ */}
      <section className="py-16 px-6 lg:px-12 bg-[#1A1818]">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="mb-8">
            <h2 
              className="text-2xl text-white mb-2"
              style={{ fontFamily: 'Lora, serif' }}
            >
              Case Study Document
            </h2>
            <p className="text-white/50" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Explore the full case study below
            </p>
          </div>

          {caseStudy.pdf_url ? (
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl">
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
              
              {/* PDF Embed using Google Docs Viewer */}
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(caseStudy.pdf_url)}&embedded=true`}
                className="w-full"
                style={{ height: 'calc(100vh - 100px)', minHeight: '700px' }}
                onLoad={() => setPdfLoading(false)}
                title={`${caseStudy.title} PDF`}
                frameBorder="0"
              />
              
              {/* Download button */}
              <div className="absolute top-4 right-4 z-20">
                <a
                  href={caseStudy.pdf_url}
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
            <div className="bg-white/5 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl text-white mb-3" style={{ fontFamily: 'Lora, serif' }}>
                Document Coming Soon
              </h3>
              <p className="text-white/60 max-w-md mx-auto" style={{ fontFamily: 'Poppins, sans-serif' }}>
                The detailed case study document is being prepared.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 3: KNOWLEDGE BASE */}
      {/* ============================================ */}
      {(relatedArticles.length > 0 || supportVideos.length > 0) && (
        <section className="py-16 px-6 lg:px-12 bg-[#252323]">
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="mb-12 text-center">
              <h2 
                className="text-3xl text-white mb-3"
                style={{ fontFamily: 'Lora, serif' }}
              >
                Knowledge Base
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Explore related articles and supplementary content
              </p>
            </div>

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <div className="mb-16">
                <h3 
                  className="text-xl text-white mb-6 flex items-center gap-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  <svg className="w-5 h-5 text-[#F96A63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  Related Articles
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/article/${article.slug}`}
                      className="group bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[4/3] bg-[#1A1818] relative overflow-hidden">
                        {article.thumbnail_url ? (
                          <img
                            src={article.thumbnail_url}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2D2A2A] to-[#1A1818]">
                            <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="p-5">
                        <h4 
                          className="text-white font-medium mb-2 line-clamp-2 group-hover:text-[#F96A63] transition-colors"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          {article.title}
                        </h4>
                        {article.summary && (
                          <p 
                            className="text-white/50 text-sm line-clamp-2"
                            style={{ fontFamily: 'Poppins, sans-serif' }}
                          >
                            {article.summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Support Videos */}
            {supportVideos.length > 0 && (
              <div>
                <h3 
                  className="text-xl text-white mb-6 flex items-center gap-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  <svg className="w-5 h-5 text-[#0097A7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Support Videos
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {supportVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-white/5 rounded-xl overflow-hidden"
                    >
                      <video
                        controls
                        className="w-full aspect-video bg-black"
                        preload="metadata"
                      >
                        <source src={video.video_url} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                      
                      {video.title && (
                        <div className="p-4">
                          <h4 
                            className="text-white font-medium"
                            style={{ fontFamily: 'Poppins, sans-serif' }}
                          >
                            {video.title}
                          </h4>
                          {video.description && (
                            <p className="text-white/50 text-sm mt-1">
                              {video.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* CTA SECTION */}
      {/* ============================================ */}
      <section className="bg-[#1A1818] border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 py-16 lg:py-20 text-center">
          <h2 
            className="text-2xl sm:text-3xl lg:text-4xl text-white mb-4"
            style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
          >
            Interested in similar work?
          </h2>
          <p 
            className="text-white/60 text-lg mb-8 max-w-xl mx-auto"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Let's discuss how Article Group can help with your next project.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#F96A63] text-white font-medium rounded-full hover:bg-[#e85a53] transition-colors"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Start a Conversation
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
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
            
            <div className="flex items-center gap-6">
              <Link 
                href="/"
                className="text-white/40 hover:text-white transition-colors text-sm"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Back to Concierge
              </Link>
              <Link 
                href="/contact"
                className="text-white/40 hover:text-white transition-colors text-sm"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Contact
              </Link>
            </div>
            
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
