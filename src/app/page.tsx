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

import React, { useState, useCallback, useRef, useEffect, useReducer, useMemo } from 'react';
import Link from 'next/link';
import { LayoutRenderer } from '@/components/LayoutRenderer';
import { UILogger } from '@/lib/logger';
import type { LayoutComponent, OrchestratorOutput } from '@/types';
import { SseDecoder, type StreamEvent } from '@/lib/stream-events';
import {
  deriveLayout,
  initialStreamView,
  streamViewReducer,
  NETWORK_ERROR_MESSAGE,
  type StreamViewAction,
  type StreamViewState,
} from '@/lib/stream-view';

// Rollback switch (D-509): NEXT_PUBLIC_CHAT_STREAM=false returns to the JSON /api/chat path.
const USE_STREAM = process.env.NEXT_PUBLIC_CHAT_STREAM !== 'false';

type PageViewAction = StreamViewAction | { type: '__reset' };
function pageViewReducer(s: StreamViewState, a: PageViewAction): StreamViewState {
  return a.type === '__reset' ? initialStreamView : streamViewReducer(s, a);
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Conversation message type
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  layoutPlan?: OrchestratorOutput['layoutPlan'];
  suggestedFollowUps?: string[];
  timestamp: Date;
  /** Arrived through the stream: reserve narrative space so the deck does not shift. */
  streamed?: boolean;
  /** Kept after a mid-stream error; dropped again on retry. */
  partial?: boolean;
}

interface LiveInfo {
  pendingHero: boolean;
  exitingSlugs: ReadonlySet<string>;
  exiting: LayoutComponent[];
  streaming: boolean;
  writingLine: boolean;
}

function PulseDots() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <div className="w-2 h-2 bg-[#fc5d4c] rounded-full animate-pulse" />
      <div className="w-2 h-2 bg-[#47ddb2] rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-[#0d72d1] rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="bg-white p-8 border border-[#eee]">
      <div className="flex gap-5">
        <div className="flex-shrink-0 w-10 h-10 bg-black rounded flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
        <div className="flex-1">
          <p className="text-[#6B6B6B] mb-3">{text}</p>
          <PulseDots />
        </div>
      </div>
    </div>
  );
}

/**
 * One assistant turn. The live (streaming) message and the stored message render through this
 * same component under the same key, so nothing remounts when the stream finalises.
 */
function AssistantMessage({
  message,
  isLast,
  live,
  onFollowUp,
  disabled,
}: {
  message: Message;
  isLast: boolean;
  live?: LiveInfo;
  onFollowUp: (q: string) => void;
  disabled: boolean;
}) {
  const hasDeck =
    (!!message.layoutPlan && message.layoutPlan.layout.length > 0) ||
    !!live?.pendingHero ||
    (live?.exiting.length ?? 0) > 0;
  const reserveNarrative = !!live || (!!message.streamed && !!message.content);

  return (
    <div className="space-y-8" aria-live="polite" aria-busy={live?.streaming ? 'true' : 'false'}>
      {/* Response text */}
      {hasDeck && (
        <div className="mb-6">
          <div
            className={`max-w-3xl ${reserveNarrative ? 'min-h-[7rem] md:min-h-[8.75rem]' : ''}`}
          >
            {message.content ? (
              <p className="text-[#313131] text-lg md:text-xl leading-relaxed">{message.content}</p>
            ) : live ? (
              <div className="space-y-3" aria-hidden="true">
                <div className="h-5 bg-[#eee] rounded animate-pulse w-full" />
                <div className="h-5 bg-[#eee] rounded animate-pulse w-11/12" />
                <div className="h-5 bg-[#eee] rounded animate-pulse w-2/3" />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Layout/Visual Content */}
      {hasDeck && (
        <div className="bg-white p-8 md:p-10 border border-[#eee]">
          <LayoutRenderer
            layoutPlan={message.layoutPlan ?? { layout: [] }}
            pendingHero={live?.pendingHero}
            exitingSlugs={live?.exitingSlugs}
            exiting={live?.exiting}
          />
        </div>
      )}

      {/* Response without layout */}
      {!hasDeck && (
        <div className="bg-white p-8 border border-[#eee]">
          <div className="flex gap-5">
            <div className="flex-shrink-0 w-10 h-10 bg-black rounded flex items-center justify-center">
              <span className="text-white font-semibold text-sm">AG</span>
            </div>
            <div className="flex-1">
              <p className="text-[#313131] text-lg leading-relaxed">{message.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* Streaming status line (one line below the deck) */}
      {live?.writingLine && (
        <div className="flex items-center gap-3">
          <p className="text-[#6B6B6B]">Writing your answer...</p>
          <PulseDots />
        </div>
      )}

      {/* Follow-up suggestions */}
      {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && isLast && (
        <div className="bg-white p-8 border border-[#eee]">
          <p className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider mb-4">
            Continue exploring
          </p>
          <div className="flex flex-wrap gap-3">
            {message.suggestedFollowUps.map((followUp, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(followUp)}
                disabled={disabled}
                className="group px-5 py-3 text-sm text-black bg-[#F5F5F5] border border-transparent hover:border-black transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}

export default function ConciergePage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<{ message: string; retryable: boolean; failedQuery: string } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [view, dispatch] = useReducer(pageViewReducer, initialStreamView);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState(0);

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
      UILogger.error('Failed to parse saved messages', e);
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

  // Scroll to the latest response: once on submit and once at the first stream event,
  // never on final or token events so the reader is not yanked while streaming.
  useEffect(() => {
    if (scrollRequest > 0 && latestResponseRef.current) {
      latestResponseRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollRequest]);

  const submitJson = useCallback(async (
    trimmedQuery: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          conversationHistory: history,
        }),
      });

      // Always try to read the body — server returns a structured OrchestratorOutput
      // even on failure, with `explanation` set to a user-friendly message.
      const data: OrchestratorOutput = await response.json().catch(() => ({
        layoutPlan: { layout: [] },
        explanation: 'We had trouble reaching the concierge. Please try again.',
        retryable: true,
      }));

      if (!response.ok) {
        setError({
          message: data.explanation,
          retryable: data.retryable ?? true,
          failedQuery: trimmedQuery,
        });
        UILogger.error('Submit error', { status: response.status, errorCode: data.errorCode });
        return;
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.explanation,
        layoutPlan: data.layoutPlan,
        suggestedFollowUps: data.suggestedFollowUps,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setScrollRequest(n => n + 1);

    } catch (err) {
      // Network-level failure (offline, DNS, etc.)
      setError({
        message: NETWORK_ERROR_MESSAGE,
        retryable: true,
        failedQuery: trimmedQuery,
      });
      UILogger.error('Submit error', err);
    }
  }, []);

  const submitStream = useCallback(async (
    trimmedQuery: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => {
    const id = `assistant-${Date.now()}`;
    // Local mirror of the view state so the loop can read the latest state synchronously.
    let local: StreamViewState = initialStreamView;
    let finished = false;
    let scrolled = false;

    dispatch({ type: '__reset' });
    setLiveId(id);

    const clearLive = () => {
      setLiveId(null);
      dispatch({ type: '__reset' });
    };

    const commitFinal = (st: StreamViewState) => {
      const out = st.final;
      if (!out) return;
      setMessages(prev => [
        ...prev,
        {
          id,
          role: 'assistant',
          content: out.explanation,
          layoutPlan: out.layoutPlan,
          suggestedFollowUps: out.suggestedFollowUps,
          timestamp: new Date(),
          streamed: true,
        },
      ]);
      clearLive();
    };

    // Error after (possibly) some content: keep the rendered deck, show the banner below it.
    const commitError = (st: StreamViewState) => {
      const { layout } = deriveLayout(st);
      if (layout.length > 0 || st.narrative.trim()) {
        setMessages(prev => [
          ...prev,
          {
            id,
            role: 'assistant',
            content: st.narrative,
            layoutPlan: { layout },
            timestamp: new Date(),
            streamed: true,
            partial: true,
          },
        ]);
      }
      clearLive();
      setError({
        message: st.error?.message ?? NETWORK_ERROR_MESSAGE,
        retryable: st.error?.retryable ?? true,
        failedQuery: trimmedQuery,
      });
      UILogger.error('Stream error', { message: st.error?.message });
    };

    const handle = async (events: StreamEvent[]) => {
      for (const ev of events) {
        if (finished) return;
        local = streamViewReducer(local, ev);
        dispatch(ev);
        if (!scrolled && (ev.type === 'teasers' || ev.type === 'suppressed')) {
          scrolled = true;
          setScrollRequest(n => n + 1);
        }
        if (ev.type === 'final') {
          finished = true;
          // Let unchosen teasers fade (150 ms) before the stored message replaces the live one.
          if (local.exitingSlugs.length > 0) await sleep(150);
          commitFinal(local);
        } else if (ev.type === 'error') {
          finished = true;
          commitError(local);
        }
      }
    };

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          conversationHistory: history,
        }),
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.includes('text/event-stream') || !response.body) {
        const data: OrchestratorOutput = await response.json().catch(() => ({
          layoutPlan: { layout: [] },
          explanation: 'We had trouble reaching the concierge. Please try again.',
          retryable: true,
        }));
        clearLive();
        setError({
          message: data.explanation,
          retryable: data.retryable ?? true,
          failedQuery: trimmedQuery,
        });
        UILogger.error('Submit error', { status: response.status, errorCode: data.errorCode });
        return;
      }

      const reader = response.body.getReader();
      const textDecoder = new TextDecoder();
      const decoder = new SseDecoder();

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        await handle(decoder.push(textDecoder.decode(value, { stream: true })));
      }
      if (!finished) await handle(decoder.flush());
      if (finished) {
        reader.cancel().catch(() => undefined);
      } else {
        // Body ended with neither final nor error.
        local = streamViewReducer(local, { type: 'closed' });
        finished = true;
        commitError(local);
      }
    } catch (err) {
      if (!finished) {
        finished = true;
        local = streamViewReducer(local, { type: 'closed' });
        commitError(local);
      }
      UILogger.error('Submit error', err);
    }
  }, []);

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
    setScrollRequest(n => n + 1);

    // Kept-after-error turns with no text would be empty history entries; skip those.
    const history = messages
      .filter(m => m.content.trim().length > 0)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      if (USE_STREAM) {
        await submitStream(trimmedQuery, history);
      } else {
        await submitJson(trimmedQuery, history);
      }
    } finally {
      setIsLoading(false);
    }
  }, [query, isLoading, messages, submitStream, submitJson]);

  const handleRetry = useCallback(() => {
    if (!error) return;
    const queryToRetry = error.failedQuery;
    setError(null);
    // Drop the trailing user message we added for the failed attempt — handleSubmit
    // will re-add it. This keeps the conversation clean.
    setMessages(prev => {
      let next = prev;
      // A deck kept after a mid-stream error is replaced by the retry.
      const tail = next[next.length - 1];
      if (tail && tail.role === 'assistant' && tail.partial) {
        next = next.slice(0, -1);
      }
      const last = next[next.length - 1];
      if (last && last.role === 'user' && last.content === queryToRetry) {
        return next.slice(0, -1);
      }
      return next;
    });
    handleSubmit(undefined, queryToRetry);
  }, [error, handleSubmit]);

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

  // Streaming view: the live message is rendered through the same component and key as the stored one.
  const derived = useMemo(() => deriveLayout(view), [view]);
  const exitingSet = useMemo(() => new Set(derived.exitingSlugs), [derived]);
  const liveVisible = liveId !== null && view.phase !== 'waiting' && view.phase !== 'error';
  const suppressedPreHero = view.suppressed !== null && !view.hero && view.phase !== 'done';
  const streamingNow = isLoading && view.phase !== 'done' && view.phase !== 'error';
  const live: LiveInfo = {
    pendingHero: derived.pendingHero,
    exitingSlugs: exitingSet,
    exiting: derived.exiting,
    streaming: streamingNow,
    writingLine: streamingNow && !suppressedPreHero,
  };
  const conversation: Message[] =
    liveVisible && liveId && !messages.some(m => m.id === liveId)
      ? [
          ...messages,
          {
            id: liveId,
            role: 'assistant',
            content: view.final?.explanation ?? view.narrative,
            layoutPlan: { layout: derived.layout },
            timestamp: new Date(0),
            streamed: true,
          },
        ]
      : messages;
  const showLoadingCard = isLoading && (!liveVisible || suppressedPreHero);

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
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Header - Clean AG style */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#eee]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-black rounded flex items-center justify-center">
                <span className="text-white font-semibold text-sm">AG</span>
              </div>
              <span className="font-semibold text-black text-lg hidden sm:block font-serif">
                Article Group
              </span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
              {messages.length > 0 && (
                <button
                  onClick={handleNewConversation}
                  className="text-sm text-[#313131] hover:text-black transition-colors cursor-pointer"
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
                className="px-5 py-2 bg-[#32373c] text-white text-sm font-medium hover:bg-black transition-colors"
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 flex flex-col">
        {/* Loading state before hydration */}
        {!isHydrated && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#eee] border-t-[#fc5d4c] rounded-full animate-spin" />
          </div>
        )}

        {/* Welcome State */}
        {showWelcome && (
          <div className="flex-1">
            {/* Hero Section - Full viewport height like AG */}
            <section className="min-h-[calc(100vh-64px)] flex flex-col justify-center py-16 md:py-24">
              <div className="max-w-[1200px] mx-auto px-6 lg:px-8 flex-1 flex flex-col justify-center">
                {/* Main headline - AG style with tighter line height */}
                <h1
                  className="text-[2.75rem] sm:text-[4rem] lg:text-[5rem] text-black leading-[1.05] max-w-5xl mb-8 animate-fade-in-up font-serif font-normal tracking-tight"
                >
                  Finding simple solutions to complex messages.
                </h1>

                {/* Subheadline */}
                <p
                  className="text-lg md:text-xl text-[#313131] max-w-2xl mb-14 leading-relaxed animate-fade-in-up"
                  style={{ animationDelay: '100ms' }}
                >
                  Communicating a vision is hard. We&apos;re really good at it. Tell us your challenge.
                </p>

                {/* Input Area */}
                <div className="max-w-2xl animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  <form onSubmit={handleSubmit} className="relative group">
                    <textarea
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="What challenge can we help you with?"
                      className="
                        w-full px-6 py-5 pr-16
                        bg-white
                        border-2 border-[#313131]
                        text-lg text-black
                        placeholder:text-[#595959]
                        focus:outline-none focus:border-black
                        transition-all duration-300
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

                  <p className="text-sm text-[#595959] mt-4 flex items-center gap-2">
                    <span>Press Enter to send</span>
                    <span className="text-[#D4D4D4]">|</span>
                    <span className="text-[#fc5d4c]">Shift+Enter for new line</span>
                  </p>
                </div>
              </div>

              {/* Scroll indicator - AG style */}
              <div className="flex justify-center pb-8 animate-fade-in" style={{ animationDelay: '400ms' }}>
                <div className="flex flex-col items-center gap-2 text-[#6B6B6B]">
                  <span className="text-xs uppercase tracking-wider">Explore</span>
                  <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>
            </section>

            {/* Example Prompts - AG card style */}
            <section className="py-20 lg:py-28 bg-[#F5F5F5]">
              <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
                  <div>
                    <p className="text-sm font-medium text-[#fc5d4c] uppercase tracking-wider mb-3">
                      Common Challenges
                    </p>
                    <h2 className="text-2xl md:text-3xl text-black font-serif font-normal">
                      Or explore by topic
                    </h2>
                  </div>
                  <p className="text-[#595959] text-sm md:text-right max-w-xs">
                    Click any card to start a conversation about that challenge
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {examplePrompts.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(undefined, item.prompt)}
                      className="
                        group p-8 text-left
                        bg-white
                        border border-transparent hover:border-black
                        transition-all duration-300
                        relative overflow-hidden
                        cursor-pointer
                      "
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      {/* Accent line */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fc5d4c] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3
                            className="text-lg font-medium text-black mb-3 group-hover:text-[#fc5d4c] transition-colors"
                          >
                            {item.label}
                          </h3>
                          <p className="text-[#313131] leading-relaxed">
                            &ldquo;{item.prompt}&rdquo;
                          </p>
                        </div>
                        <svg
                          className="w-5 h-5 text-[#6B6B6B] group-hover:text-[#fc5d4c] transform group-hover:translate-x-1 transition-all flex-shrink-0 mt-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Client Logos - AG style with divider */}
            <section className="py-20 lg:py-24">
              <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
                {/* Decorative divider */}
                <div className="flex items-center justify-center gap-3 mb-12">
                  <div className="w-2 h-2 rounded-full bg-[#fc5d4c]" />
                  <div className="w-2 h-2 rounded-full bg-[#47ddb2]" />
                  <div className="w-2 h-2 rounded-full bg-[#0d72d1]" />
                </div>

                <p className="text-center text-black mb-14 text-lg md:text-xl font-serif">
                  Trusted by the world&apos;s most innovative companies.
                </p>

                <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6 lg:gap-x-16">
                  {clients.map((client, i) => (
                    <span
                      key={i}
                      className="text-[#737373] font-medium text-base lg:text-lg hover:text-black transition-colors duration-300 cursor-default"
                    >
                      {client}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Testimonial - AG style with large quote */}
            <section className="py-24 lg:py-32 bg-[#F5F5F5] relative">
              {/* Large decorative quote */}
              <div className="absolute top-12 left-1/2 transform -translate-x-1/2 text-[12rem] lg:text-[16rem] text-[#eee] leading-none select-none pointer-events-none font-serif">
                &ldquo;
              </div>

              <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative">
                <blockquote className="mb-10">
                  <p className="text-2xl md:text-3xl lg:text-4xl text-black leading-snug font-serif font-normal">
                    Working with Article Group, you get the ideal mix of technology-translator, storyteller, and teammate. And they deliver the most beautiful work.
                  </p>
                </blockquote>
                <div className="flex flex-col items-center gap-1">
                  <cite className="not-italic font-semibold text-black text-lg">
                    Dr. Werner Vogels
                  </cite>
                  <span className="text-[#6B6B6B]">CTO of Amazon.com</span>
                </div>
              </div>
            </section>

            {/* CTA Section - More impactful */}
            <section className="py-24 lg:py-32 bg-black relative overflow-hidden">
              {/* Subtle gradient orbs */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#fc5d4c]/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#0d72d1]/10 rounded-full blur-3xl" />

              <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative">
                <h3 className="text-3xl md:text-4xl lg:text-5xl text-white mb-6 font-serif font-normal tracking-tight">
                  Ready to tell your story?
                </h3>
                <p className="text-white/60 text-lg md:text-xl mb-12 max-w-xl mx-auto">
                  Start a conversation above or reach out directly to our team.
                </p>
                <Link
                  href="/contact"
                  className="group inline-flex items-center gap-3 px-10 py-5 bg-[#fc5d4c] text-white font-medium hover:bg-[#e54d3c] transition-all duration-300 text-lg"
                >
                  <span>Start a Conversation</span>
                  <svg
                    className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
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
              {conversation.map((message, index) => {
                const isLatestUserMessage = message.role === 'user' &&
                  (index === conversation.length - 1 || index === conversation.length - 2);
                const isLiveMessage = liveVisible && message.id === liveId;

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
                          <h2 className="text-2xl md:text-3xl text-black leading-relaxed font-serif">
                            &ldquo;{message.content}&rdquo;
                          </h2>
                        </div>
                      </div>
                    )}

                    {/* Assistant Message */}
                    {message.role === 'assistant' && (
                      <AssistantMessage
                        message={message}
                        isLast={index === conversation.length - 1}
                        live={isLiveMessage ? live : undefined}
                        onFollowUp={handleFollowUp}
                        disabled={isLoading}
                      />
                    )}
                  </div>
                );
              })}

              {/* Loading indicator (stage 0, and suppressed queries until the hero arrives) */}
              {showLoadingCard && <LoadingCard text="Looking through Article Group's work..." />}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="max-w-4xl mx-auto px-6 mb-4" role="alert" aria-live="assertive">
            <div className="p-4 bg-[#fc5d4c]/10 border border-[#fc5d4c]/20 text-[#fc5d4c] text-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <span className="flex-1">{error.message}</span>
              <div className="flex gap-2 shrink-0">
                {error.retryable && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="px-3 py-1.5 border border-[#fc5d4c] text-[#fc5d4c] hover:bg-[#fc5d4c] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Try again
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="px-3 py-1.5 text-[#fc5d4c]/80 hover:text-[#fc5d4c] transition-colors"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
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
                aria-label="Continue the conversation"
                className="
                  w-full px-5 py-4 pr-14
                  bg-[#F5F5F5]
                  border border-transparent
                  text-base text-black
                  placeholder:text-[#595959]
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
