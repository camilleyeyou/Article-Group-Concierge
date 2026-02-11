'use client';

/**
 * Article Group AI Concierge - Main Page
 *
 * Design aligned with articlegroup.com:
 * - Clean, minimal aesthetic
 * - Lora for headlines, Poppins for body
 * - Dark charcoal (#32373c) buttons
 * - Accent colors: coral (#fc5d4c), teal (#47ddb2), blue (#0d72d1)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LayoutRenderer } from '@/components/LayoutRenderer';
import type { OrchestratorOutput } from '@/types';

// Conversation message type
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  layoutPlan?: OrchestratorOutput['layoutPlan'];
  suggestedFollowUps?: string[];
  timestamp: Date;
}

export default function ConciergePage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestResponseRef = useRef<HTMLDivElement>(null);

  // Load conversation from sessionStorage on mount (client-side only)
  useEffect(() => {
    setIsHydrated(true);
    try {
      const savedMessages = sessionStorage.getItem('ag-concierge-messages');
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        const messagesWithDates = parsed.map((m: Message & { timestamp: string }) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(messagesWithDates);
      }
    } catch (e) {
      console.error('Failed to parse saved messages:', e);
    }
  }, []);

  // Save conversation to sessionStorage when messages change
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      sessionStorage.setItem('ag-concierge-messages', JSON.stringify(messages));
    }
  }, [messages, isHydrated]);

  const showWelcome = isHydrated && messages.length === 0;

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [query]);

  // Scroll to latest response
  useEffect(() => {
    if (messages.length > 0 && latestResponseRef.current) {
      latestResponseRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages]);

  // Handle query submission
  const handleSubmit = useCallback(async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();

    const trimmedQuery = (customQuery || query).trim();
    if (!trimmedQuery || isLoading) return;

    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedQuery,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data: OrchestratorOutput = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.explanation,
        layoutPlan: data.layoutPlan,
        suggestedFollowUps: data.suggestedFollowUps,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Submit error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [query, isLoading, messages]);

  const handleFollowUp = useCallback((followUp: string) => {
    handleSubmit(undefined, followUp);
  }, [handleSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionStorage.removeItem('ag-concierge-messages');
  }, []);

  // Example prompts matching AG's tone
  const examplePrompts = [
    {
      label: "Brand Strategy",
      prompt: "We're rebranding after a merger and need help unifying our story",
    },
    {
      label: "Product Launch",
      prompt: "We have a new AI product launching and need to simplify complex features",
    },
    {
      label: "Thought Leadership",
      prompt: "We want to establish our executives as industry thought leaders",
    },
    {
      label: "Event & Keynote",
      prompt: "Our CEO is keynoting at a major conference and needs presentation support",
    },
  ];

  // AG client logos from their website
  const clients = [
    "Google", "AWS", "Salesforce", "Meta", "CrowdStrike",
    "Android", "Omnicell", "Box", "Vimeo", "LinkedIn"
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Header - Clean AG style */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#eee]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-black rounded flex items-center justify-center">
                <span className="text-white font-semibold text-sm">AG</span>
              </div>
              <span className="font-semibold text-black text-lg hidden sm:block" style={{ fontFamily: 'Lora, serif' }}>
                Article Group
              </span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
              {messages.length > 0 && (
                <button
                  onClick={handleNewConversation}
                  className="text-sm text-[#313131] hover:text-black transition-colors"
                >
                  New Chat
                </button>
              )}
              <Link
                href="https://articlegroup.com/work"
                target="_blank"
                className="text-sm text-[#313131] hover:text-black transition-colors hidden sm:block"
              >
                Work
              </Link>
              <Link
                href="/contact"
                className="px-5 py-2 bg-[#32373c] text-white text-sm font-medium rounded hover:bg-black transition-colors"
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Loading state before hydration */}
        {!isHydrated && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#eee] border-t-[#fc5d4c] rounded-full animate-spin" />
          </div>
        )}

        {/* Welcome State */}
        {showWelcome && (
          <div className="flex-1">
            {/* Hero Section */}
            <section className="py-16 md:py-24 lg:py-32">
              <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
                {/* Main headline - AG style */}
                <h1
                  className="text-[2.5rem] sm:text-[3.5rem] lg:text-[4.5rem] text-black leading-[1.1] max-w-4xl mb-8"
                  style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
                >
                  Finding simple solutions to complex messages.
                </h1>

                {/* Subheadline */}
                <p className="text-xl md:text-2xl text-[#313131] max-w-2xl mb-12 leading-relaxed">
                  Communicating a vision is hard. We're really good at it. Tell us your challenge.
                </p>

                {/* Input Area */}
                <div className="max-w-2xl">
                  <form onSubmit={handleSubmit} className="relative">
                    <textarea
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="What challenge can we help you with?"
                      className="
                        w-full px-6 py-5 pr-16
                        bg-white
                        border border-[#313131]
                        text-lg text-black
                        placeholder:text-[#6B6B6B]
                        focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2
                        transition-all duration-200
                        resize-none
                        min-h-[72px] max-h-[150px]
                      "
                      rows={1}
                      disabled={isLoading}
                    />

                    <button
                      type="submit"
                      disabled={!query.trim() || isLoading}
                      className="
                        absolute right-3 bottom-3
                        w-12 h-12
                        bg-[#32373c]
                        text-white
                        flex items-center justify-center
                        disabled:opacity-30 disabled:cursor-not-allowed
                        hover:bg-black
                        transition-colors duration-200
                      "
                      aria-label="Send message"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      )}
                    </button>
                  </form>

                  <p className="text-sm text-[#6B6B6B] mt-3">
                    Press Enter to send
                  </p>
                </div>
              </div>
            </section>

            {/* Example Prompts */}
            <section className="py-16 bg-[#F5F5F5]">
              <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
                <p className="text-sm font-medium text-[#6B6B6B] uppercase tracking-wider mb-8">
                  Or explore by challenge
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {examplePrompts.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(undefined, item.prompt)}
                      className="
                        group p-6 text-left
                        bg-white
                        border border-transparent hover:border-black
                        transition-all duration-200
                      "
                    >
                      <h3 className="font-medium text-black mb-2 group-hover:text-[#fc5d4c] transition-colors">
                        {item.label}
                      </h3>
                      <p className="text-sm text-[#313131] leading-relaxed">
                        {item.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Client Logos - Marquee style like AG */}
            <section className="py-16">
              <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
                <p className="text-center text-[#313131] mb-10 text-lg">
                  Trusted by the world's most innovative companies.
                </p>

                <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
                  {clients.map((client, i) => (
                    <span
                      key={i}
                      className="text-[#6B6B6B] font-medium text-lg hover:text-black transition-colors"
                    >
                      {client}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Testimonial */}
            <section className="py-20 bg-[#F5F5F5]">
              <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
                <blockquote className="mb-8">
                  <p
                    className="text-2xl md:text-3xl text-black leading-relaxed"
                    style={{ fontFamily: 'Lora, serif' }}
                  >
                    "Working with Article Group, you get the ideal mix of technology-translator, storyteller, and teammate. And they deliver the most beautiful work."
                  </p>
                </blockquote>
                <cite className="not-italic">
                  <span className="font-semibold text-black">Dr. Werner Vogels</span>
                  <span className="text-[#313131]"> · CTO of Amazon.com</span>
                </cite>
              </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-black">
              <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
                <h3
                  className="text-3xl md:text-4xl text-white mb-6"
                  style={{ fontFamily: 'Lora, serif' }}
                >
                  Ready to tell your story?
                </h3>
                <p className="text-white/70 text-lg mb-10">
                  Start a conversation above or reach out directly.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-[#fc5d4c] text-white font-medium hover:bg-[#e54d3c] transition-colors text-lg"
                >
                  Contact Us
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </section>
          </div>
        )}

        {/* Conversation View */}
        {isHydrated && messages.length > 0 && (
          <div className="flex-1 overflow-y-auto bg-[#F5F5F5]">
            <div className="max-w-[1000px] mx-auto px-6 lg:px-8 py-12">
              {messages.map((message, index) => {
                const isLatestUserMessage = message.role === 'user' &&
                  (index === messages.length - 1 || index === messages.length - 2);

                return (
                  <div key={message.id} className="mb-12">
                    {/* User Message */}
                    {message.role === 'user' && (
                      <div
                        className="mb-8"
                        ref={isLatestUserMessage ? latestResponseRef : null}
                      >
                        <div className="max-w-3xl">
                          <p className="text-[#fc5d4c] text-sm font-medium mb-2 uppercase tracking-wider">
                            Your challenge
                          </p>
                          <h2
                            className="text-2xl md:text-3xl text-black leading-relaxed"
                            style={{ fontFamily: 'Lora, serif' }}
                          >
                            "{message.content}"
                          </h2>
                        </div>
                      </div>
                    )}

                    {/* Assistant Message */}
                    {message.role === 'assistant' && (
                      <div className="space-y-8">
                        {/* Response text */}
                        {message.layoutPlan && message.layoutPlan.layout.length > 0 && (
                          <div className="mb-6">
                            <p className="text-[#313131] text-lg md:text-xl leading-relaxed max-w-3xl">
                              {message.content}
                            </p>
                          </div>
                        )}

                        {/* Layout/Case Studies */}
                        {message.layoutPlan && message.layoutPlan.layout.length > 0 && (
                          <div className="bg-white p-8 md:p-10 border border-[#eee]">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <p className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider mb-1">
                                  Relevant Work
                                </p>
                                <h3
                                  className="text-2xl text-black"
                                  style={{ fontFamily: 'Lora, serif' }}
                                >
                                  Case Studies
                                </h3>
                              </div>
                              <div className="hidden md:block text-sm text-[#6B6B6B]">
                                Click to view details
                              </div>
                            </div>

                            <LayoutRenderer layoutPlan={message.layoutPlan} />
                          </div>
                        )}

                        {/* Response without layout */}
                        {(!message.layoutPlan || message.layoutPlan.layout.length === 0) && (
                          <div className="bg-white p-8 border border-[#eee]">
                            <div className="flex gap-5">
                              <div className="flex-shrink-0 w-10 h-10 bg-black rounded flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">AG</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-[#313131] text-lg leading-relaxed">
                                  {message.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Follow-up suggestions */}
                        {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && index === messages.length - 1 && (
                          <div className="bg-white p-8 border border-[#eee]">
                            <p className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider mb-4">
                              Continue exploring
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {message.suggestedFollowUps.map((followUp, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleFollowUp(followUp)}
                                  className="group px-5 py-3 text-sm text-black bg-[#F5F5F5] border border-transparent hover:border-black transition-all duration-200 flex items-center gap-2"
                                >
                                  <span>{followUp}</span>
                                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading indicator */}
              {isLoading && (
                <div className="bg-white p-8 border border-[#eee]">
                  <div className="flex gap-5">
                    <div className="flex-shrink-0 w-10 h-10 bg-black rounded flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#6B6B6B] mb-3">Finding relevant case studies...</p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#fc5d4c] rounded-full animate-pulse" />
                        <div className="w-2 h-2 bg-[#47ddb2] rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-[#0d72d1] rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="max-w-4xl mx-auto px-6 mb-4">
            <div className="p-4 bg-[#fc5d4c]/10 border border-[#fc5d4c]/20 text-[#fc5d4c] text-sm text-center">
              {error}
            </div>
          </div>
        )}
      </main>

      {/* Input area - Fixed at bottom (conversation mode) */}
      {isHydrated && messages.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-[#eee]">
          <div className="max-w-[800px] mx-auto px-6 py-4">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Continue the conversation..."
                className="
                  w-full px-5 py-4 pr-14
                  bg-[#F5F5F5]
                  border border-transparent
                  text-base text-black
                  placeholder:text-[#6B6B6B]
                  focus:outline-none focus:border-black focus:bg-white
                  transition-all duration-200
                  resize-none
                  min-h-[56px] max-h-[150px]
                "
                rows={1}
                disabled={isLoading}
              />

              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="
                  absolute right-2 bottom-2
                  w-10 h-10
                  bg-[#32373c]
                  text-white
                  flex items-center justify-center
                  disabled:opacity-30 disabled:cursor-not-allowed
                  hover:bg-black
                  transition-colors duration-200
                "
                aria-label="Send message"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer - only on welcome screen */}
      {showWelcome && (
        <footer className="py-8 border-t border-[#eee]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-[#6B6B6B]">
                © {new Date().getFullYear()} Article Group
              </p>
              <div className="flex items-center gap-6 text-sm text-[#6B6B6B]">
                <Link href="https://articlegroup.com" target="_blank" className="hover:text-black transition-colors">
                  articlegroup.com
                </Link>
                <Link href="https://articlegroup.com/privacy-policy" target="_blank" className="hover:text-black transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
