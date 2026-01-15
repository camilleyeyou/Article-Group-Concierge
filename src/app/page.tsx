'use client';

/**
 * Article Group AI Concierge - Main Page
 * 
 * A polished, client-ready interface for the AI-powered pitch deck generator.
 * Features smooth animations, AG branding, and presentation-quality layouts.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  
  // Load conversation from sessionStorage on mount (client-side only)
  useEffect(() => {
    // Mark as hydrated
    setIsHydrated(true);
    
    try {
      const savedMessages = sessionStorage.getItem('ag-concierge-messages');
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        // Convert timestamp strings back to Date objects
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
  
  // Determine if we should show welcome (only after hydration)
  const showWelcome = isHydrated && messages.length === 0;
  
  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [query]);
  
  // Scroll to latest message
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle query submission
  const handleSubmit = useCallback(async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    
    const trimmedQuery = (customQuery || query).trim();
    if (!trimmedQuery || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    // Add user message
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
      
      // Add assistant message
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
  
  // Handle follow-up click
  const handleFollowUp = useCallback((followUp: string) => {
    handleSubmit(undefined, followUp);
  }, [handleSubmit]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);
  
  // Start new conversation
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionStorage.removeItem('ag-concierge-messages');
  }, []);

  // Example prompts - more conversational like AG's tone
  const examplePrompts = [
    {
      label: "Brand Strategy",
      prompt: "We're rebranding after a merger and need help unifying our story",
      icon: "✦"
    },
    {
      label: "Product Launch",
      prompt: "We have a new AI product launching and need to simplify complex features",
      icon: "◈"
    },
    {
      label: "Thought Leadership",
      prompt: "We want to establish our executives as industry thought leaders",
      icon: "◇"
    },
    {
      label: "Event & Keynote",
      prompt: "Our CEO is keynoting at a major conference and needs presentation support",
      icon: "○"
    },
  ];

  // Client logos (names only since we don't have actual logos)
  const clients = [
    "Google", "AWS", "Salesforce", "Meta", "CrowdStrike", 
    "Android", "Omnicell", "Box", "Vimeo", "LinkedIn"
  ];
  
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* AG Logo/Wordmark */}
              <div className="flex items-center gap-2">
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
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-[#1A1818] hover:bg-gray-50 rounded-lg transition-colors"
                >
                  New Conversation
                </button>
              )}
              <a
                href="mailto:hello@articlegroup.com"
                className="px-5 py-2.5 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-[#333] transition-colors"
              >
                Get in Touch
              </a>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Loading state before hydration */}
        {!isHydrated && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#F96A63] rounded-full animate-spin" />
          </div>
        )}
        
        {/* Welcome State - Premium Design */}
        {showWelcome && (
          <div className="flex-1">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] to-white" />
              
              <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
                {/* Greeting */}
                <p className="text-[#F96A63] font-medium text-lg mb-4 animate-fade-in">
                  Hi there.
                </p>
                
                {/* Main headline */}
                <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#1A1818] mb-8 leading-[1.15] max-w-3xl animate-fade-in" style={{ animationDelay: '100ms' }}>
                  We help innovative companies communicate bold visions.
                </h2>
                
                {/* Dot separator */}
                <div className="flex items-center gap-2 mb-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
                  <span className="w-2 h-2 rounded-full bg-[#1A1818]" />
                  <span className="w-2 h-2 rounded-full bg-[#1A1818] opacity-60" />
                  <span className="w-2 h-2 rounded-full bg-[#1A1818] opacity-30" />
                </div>
                
                {/* Subheadline */}
                <p className="text-xl md:text-2xl text-[#595959] max-w-2xl leading-relaxed mb-12 animate-fade-in" style={{ animationDelay: '300ms' }}>
                  Tell us about your challenge and we'll curate relevant case studies and strategic insights tailored to your needs.
                </p>
                
                {/* Input Area - Premium Style */}
                <div className="max-w-2xl animate-fade-in" style={{ animationDelay: '400ms' }}>
                  <form onSubmit={handleSubmit} className="relative">
                    <textarea
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe your challenge..."
                      className="
                        w-full px-6 py-5 pr-16
                        bg-white
                        border-2 border-[#EEEEEE]
                        rounded-2xl
                        text-lg text-[#1A1818]
                        placeholder:text-[#8A8A8A]
                        focus:outline-none focus:border-[#1A1818]
                        transition-all duration-300
                        resize-none
                        min-h-[72px] max-h-[150px]
                        shadow-sm
                        hover:shadow-md hover:border-[#D4D4D4]
                      "
                      rows={1}
                      disabled={isLoading}
                    />
                    
                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={!query.trim() || isLoading}
                      className="
                        absolute right-4 bottom-4
                        w-12 h-12 rounded-xl
                        bg-[#1A1818]
                        text-white
                        flex items-center justify-center
                        disabled:opacity-20 disabled:cursor-not-allowed
                        hover:bg-[#333] hover:scale-105
                        transition-all duration-200
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
                  
                  <p className="text-sm text-[#8A8A8A] mt-3 text-center">
                    Press Enter to send · Shift+Enter for new line
                  </p>
                </div>
              </div>
            </section>
            
            {/* Example Prompts Section */}
            <section className="bg-white py-16 border-t border-[#F3F3F3]">
              <div className="max-w-5xl mx-auto px-6">
                <p className="text-sm font-medium text-[#8A8A8A] uppercase tracking-wider mb-8">
                  Or explore by challenge
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {examplePrompts.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(undefined, item.prompt)}
                      className="
                        group p-6 text-left 
                        bg-[#FAFAFA] hover:bg-white
                        border border-[#EEEEEE] hover:border-[#1A1818]
                        rounded-xl
                        transition-all duration-300
                        hover:shadow-lg
                      "
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-2xl text-[#F96A63] group-hover:scale-110 transition-transform">
                          {item.icon}
                        </span>
                        <div className="flex-1">
                          <h3 className="font-medium text-[#1A1818] mb-1 group-hover:text-[#F96A63] transition-colors">
                            {item.label}
                          </h3>
                          <p className="text-sm text-[#595959] leading-relaxed">
                            {item.prompt}
                          </p>
                        </div>
                        <svg 
                          className="w-5 h-5 text-[#8A8A8A] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            
            {/* Client Logos Section */}
            <section className="py-16 bg-[#FAFAFA]">
              <div className="max-w-5xl mx-auto px-6">
                <p className="text-center text-[#595959] mb-10 text-lg">
                  You're in good company. The world's most successful brands trust us with their vision.
                </p>
                
                <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6">
                  {clients.map((client, i) => (
                    <span 
                      key={i}
                      className="text-[#8A8A8A] font-medium text-lg hover:text-[#1A1818] transition-colors cursor-default"
                    >
                      {client}
                    </span>
                  ))}
                </div>
              </div>
            </section>
            
            {/* Testimonial Section */}
            <section className="py-20 bg-white">
              <div className="max-w-3xl mx-auto px-6 text-center">
                <blockquote className="mb-8">
                  <p className="font-serif text-2xl md:text-3xl text-[#1A1818] leading-relaxed italic">
                    "Working with Article Group, you get the ideal mix of technology-translator, storyteller, and teammate. And they deliver the most beautiful work."
                  </p>
                </blockquote>
                <cite className="not-italic">
                  <span className="font-semibold text-[#1A1818]">Dr. Werner Vogels</span>
                  <span className="text-[#595959]"> · CTO of Amazon.com</span>
                </cite>
              </div>
            </section>
            
            {/* CTA Section */}
            <section className="py-16 bg-[#1A1818]">
              <div className="max-w-3xl mx-auto px-6 text-center">
                <h3 className="font-serif text-3xl md:text-4xl text-white mb-6">
                  Ready to tell your story?
                </h3>
                <p className="text-white/60 text-lg mb-10">
                  Start a conversation above or reach out directly. We'd love to hear from you.
                </p>
                <a
                  href="mailto:hello@articlegroup.com"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-[#F96A63] text-white font-semibold rounded-full hover:bg-[#e85d56] transition-all duration-300 text-lg"
                >
                  Contact Us
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </section>
          </div>
        )}
        
        {/* Conversation View */}
        {isHydrated && messages.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {messages.map((message, index) => (
                <div key={message.id} className="mb-8 animate-fade-in">
                  {/* User Message */}
                  {message.role === 'user' && (
                    <div className="flex justify-end mb-8">
                      <div className="max-w-xl">
                        <div className="bg-[#1A1818] text-white px-5 py-3 rounded-2xl rounded-br-md">
                          <p className="text-sm md:text-base">{message.content}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-right">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Assistant Message */}
                  {message.role === 'assistant' && (
                    <div className="space-y-6">
                      {/* Layout/Presentation */}
                      {message.layoutPlan && message.layoutPlan.layout.length > 0 && (
                        <div className="bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100">
                          <LayoutRenderer layoutPlan={message.layoutPlan} />
                        </div>
                      )}
                      
                      {/* Explanation */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-[#F96A63] to-[#0097A7] rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 leading-relaxed">
                            {message.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-3">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Follow-up suggestions */}
                      {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && index === messages.length - 1 && (
                        <div className="pl-12">
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                            Explore further
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {message.suggestedFollowUps.map((followUp, i) => (
                              <button
                                key={i}
                                onClick={() => handleFollowUp(followUp)}
                                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-full hover:border-[#1A1818] hover:text-[#1A1818] transition-colors"
                              >
                                {followUp}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-4 mb-8 animate-fade-in">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-[#F96A63] to-[#0097A7] rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm text-center">
              {error}
            </div>
          </div>
        )}
      </main>
      
      {/* Input area - Fixed at bottom (only in conversation mode) */}
      {isHydrated && messages.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Continue the conversation..."
                className="
                  w-full px-5 py-4 pr-14
                  bg-gray-50
                  border border-gray-200
                  rounded-2xl
                  text-base text-[#1A1818]
                  placeholder:text-gray-400
                  focus:outline-none focus:border-[#1A1818] focus:bg-white
                  focus:ring-1 focus:ring-[#1A1818]
                  transition-all duration-200
                  resize-none
                  min-h-[56px] max-h-[150px]
                "
                rows={1}
                disabled={isLoading}
              />
              
              {/* Submit button */}
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="
                  absolute right-3 bottom-3
                  w-10 h-10 rounded-xl
                  bg-[#1A1818]
                  text-white
                  flex items-center justify-center
                  disabled:opacity-30 disabled:cursor-not-allowed
                  hover:bg-[#333]
                  transition-all duration-200
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
            
            <p className="text-xs text-gray-400 mt-2 text-center">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
      
      {/* Add animation styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
