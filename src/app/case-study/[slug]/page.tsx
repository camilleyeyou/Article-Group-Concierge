'use client';

/**
 * Case Study Detail Page - PDF Viewer
 * 
 * Displays the original case study PDF directly, preserving the
 * client's designed layout. Falls back to text content if no PDF available.
 */

import React, { useEffect, useState } from 'react';
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
  hero_image_url: string | null;
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

export default function CaseStudyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
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

      {/* Header Section */}
      <section className="pt-24 pb-8 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              {/* Client badge */}
              {clientName && (
                <div className="mb-4">
                  <span 
                    className="inline-block px-4 py-1.5 bg-white/10 text-white/80 text-sm font-medium rounded-full"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {clientName}
                  </span>
                </div>
              )}
              
              {/* Title */}
              <h1 
                className="text-3xl sm:text-4xl lg:text-5xl text-white leading-tight max-w-3xl"
                style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
              >
                {projectTitle}
              </h1>
            </div>
            
            {/* Tags */}
            {(capabilities.length > 0 || industries.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {capabilities.map((cap, i) => (
                  <span 
                    key={i} 
                    className="px-3 py-1.5 text-sm bg-[#0097A7]/20 text-[#0097A7] rounded-full"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {cap.name}
                  </span>
                ))}
                {industries.map((ind, i) => (
                  <span 
                    key={i} 
                    className="px-3 py-1.5 text-sm bg-white/10 text-white/60 rounded-full"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {ind.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PDF Viewer Section */}
      <section className="px-6 lg:px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          {caseStudy.pdf_url ? (
            <div className="relative bg-white rounded-xl overflow-hidden shadow-2xl">
              {/* PDF Loading indicator */}
              {pdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-[#EEEEEE] border-t-[#F96A63] rounded-full animate-spin" />
                    <p className="text-[#595959]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Loading PDF...
                    </p>
                  </div>
                </div>
              )}
              
              {/* PDF Embed */}
              <iframe
                src={`${caseStudy.pdf_url}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full"
                style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
                onLoad={() => setPdfLoading(false)}
                title={`${caseStudy.title} PDF`}
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
            // Fallback: No PDF available message
            <div className="bg-white/5 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 
                className="text-xl text-white mb-3"
                style={{ fontFamily: 'Lora, serif' }}
              >
                PDF Coming Soon
              </h3>
              <p 
                className="text-white/60 max-w-md mx-auto mb-8"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                The detailed case study PDF for this project is being prepared. 
                Contact us to learn more about this work.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#F96A63] text-white font-medium rounded-full hover:bg-[#e85a53] transition-colors"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Request Case Study
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#252323] mt-8">
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
