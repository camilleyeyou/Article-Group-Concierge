'use client';

/**
 * Contact Page
 * 
 * Matching the Article Group website contact page design.
 * Features contact form and office locations.
 */

import React, { useState } from 'react';
import { UILogger } from '@/lib/logger';
import Link from 'next/link';

// Service options for the form
const services = [
  { id: 'messaging', label: 'Messaging and narrative' },
  { id: 'sales', label: 'Sales and marketing assets' },
  { id: 'gtm', label: 'GTM planning' },
  { id: 'content', label: 'Content strategy' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'video', label: 'Video' },
  { id: 'events', label: 'Events' },
  { id: 'other', label: 'Other?' },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
    services: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter(s => s !== serviceId)
        : [...prev.services, serviceId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission - replace with actual endpoint
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In production, send to your backend or email service
    UILogger.info('Form submitted', { formData });
    
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#1A1818] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">AG</span>
              </div>
              <div>
                <h1 className="font-semibold text-[#1A1818] text-lg leading-tight">
                  Article Group
                </h1>
                <p className="text-xs text-gray-500">
                  Strategic Concierge
                </p>
              </div>
            </Link>
            
            <Link
              href="/"
              className="flex items-center gap-2 text-[#595959] hover:text-[#1A1818] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back to Concierge</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-[#FAFAFA] py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#1A1818] mb-6 leading-tight">
            Let's do great work together
          </h1>
          <p className="text-xl text-[#595959]">
            Please get in touch
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
            
            {/* Contact Form */}
            <div>
              {!isSubmitted ? (
                <>
                  <p className="text-[#595959] mb-8">
                    Tell us a little about yourself, your organization, and your needs
                  </p>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-[#1A1818] mb-2">
                        Name <span className="text-[#F96A63]">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 border border-[#EEEEEE] rounded-lg focus:outline-none focus:border-[#1A1818] transition-colors"
                        placeholder="Your name"
                      />
                    </div>
                    
                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-[#1A1818] mb-2">
                        Email <span className="text-[#F96A63]">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 border border-[#EEEEEE] rounded-lg focus:outline-none focus:border-[#1A1818] transition-colors"
                        placeholder="your@email.com"
                      />
                    </div>
                    
                    {/* Company */}
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-[#1A1818] mb-2">
                        Company
                      </label>
                      <input
                        type="text"
                        id="company"
                        value={formData.company}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                        className="w-full px-4 py-3 border border-[#EEEEEE] rounded-lg focus:outline-none focus:border-[#1A1818] transition-colors"
                        placeholder="Your company"
                      />
                    </div>
                    
                    {/* Services */}
                    <div>
                      <label className="block text-sm font-medium text-[#1A1818] mb-4">
                        What can we do for you? <span className="text-[#F96A63]">*</span>
                      </label>
                      <p className="text-sm text-[#8A8A8A] mb-4">Check all that apply</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {services.map((service) => (
                          <label
                            key={service.id}
                            className={`
                              flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all
                              ${formData.services.includes(service.id)
                                ? 'border-[#1A1818] bg-[#1A1818] text-white'
                                : 'border-[#EEEEEE] hover:border-[#1A1818] text-[#595959]'
                              }
                            `}
                          >
                            <input
                              type="checkbox"
                              checked={formData.services.includes(service.id)}
                              onChange={() => handleServiceToggle(service.id)}
                              className="sr-only"
                            />
                            <div className={`
                              w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                              ${formData.services.includes(service.id)
                                ? 'border-white bg-white'
                                : 'border-[#CCCCCC]'
                              }
                            `}>
                              {formData.services.includes(service.id) && (
                                <svg className="w-3 h-3 text-[#1A1818]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm font-medium">{service.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-[#1A1818] mb-2">
                        Tell us more about your project
                      </label>
                      <textarea
                        id="message"
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        className="w-full px-4 py-3 border border-[#EEEEEE] rounded-lg focus:outline-none focus:border-[#1A1818] transition-colors resize-none"
                        placeholder="What challenges are you facing? What are your goals?"
                      />
                    </div>
                    
                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting || formData.services.length === 0}
                      className="
                        w-full sm:w-auto px-10 py-4 
                        bg-[#F96A63] text-white font-semibold 
                        rounded-full 
                        hover:bg-[#e85d56] 
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-300
                        flex items-center justify-center gap-3
                      "
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Submit
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                /* Thank You Message */
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-8 bg-[#1A1818] rounded-2xl flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">AG</span>
                  </div>
                  <h2 className="font-serif text-3xl md:text-4xl text-[#1A1818] mb-4">
                    Thank you!
                  </h2>
                  <p className="text-xl text-[#595959] mb-8">
                    We'll be in touch soon.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-[#F96A63] font-medium hover:gap-3 transition-all"
                  >
                    Back to Concierge
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
            
            {/* Locations */}
            <div>
              <h2 className="font-serif text-2xl text-[#1A1818] mb-8">Our Locations</h2>
              
              <div className="space-y-8">
                {/* New York */}
                <div className="p-6 bg-[#FAFAFA] rounded-xl">
                  <h3 className="font-semibold text-[#1A1818] text-lg mb-3">New York, NY</h3>
                  <p className="text-[#595959] leading-relaxed">
                    224 W 35th St Ste 500-1142<br />
                    New York, NY 10001
                  </p>
                </div>
                
                {/* Rochester */}
                <div className="p-6 bg-[#FAFAFA] rounded-xl">
                  <h3 className="font-semibold text-[#1A1818] text-lg mb-3">Rochester, NY</h3>
                  <p className="text-[#595959] leading-relaxed">
                    210 South Ave, Suite 140<br />
                    Rochester, NY 14604
                  </p>
                </div>
              </div>
              
              {/* Direct Contact */}
              <div className="mt-12 p-6 border border-[#EEEEEE] rounded-xl">
                <h3 className="font-semibold text-[#1A1818] text-lg mb-4">Prefer email?</h3>
                <a 
                  href="mailto:hello@articlegroup.com"
                  className="inline-flex items-center gap-2 text-[#F96A63] font-medium hover:gap-3 transition-all"
                >
                  hello@articlegroup.com
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A1818] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-[#1A1818] font-bold text-lg">AG</span>
              </div>
              <span className="text-white font-medium">Article Group</span>
            </div>
            
            <p className="text-white/50 text-sm">
              © {new Date().getFullYear()} Article Group. All rights reserved.
            </p>
            
            <Link 
              href="/"
              className="text-white/70 hover:text-white transition-colors text-sm"
            >
              Back to Concierge
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
