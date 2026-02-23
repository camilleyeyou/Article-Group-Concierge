'use client';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Prevents the entire app from crashing when a component error occurs.
 */

import React, { Component, ReactNode } from 'react';
import { UILogger } from '../lib/logger';
import { captureException } from '../lib/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to our logger
    UILogger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });

    // Send to Sentry if enabled
    captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg
                className="w-6 h-6 text-red-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              We encountered an unexpected error. Please try refreshing the page or contact support if
              the problem persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-[#32373c] text-white rounded hover:bg-[#1a1a1a] transition-colors text-sm font-medium"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Convenience wrapper for layout components
 */
export const LayoutErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-6 rounded-lg border border-red-200 bg-red-50 text-center">
          <p className="text-red-800 text-sm font-medium mb-2">Component Error</p>
          <p className="text-red-600 text-sm">
            This section could not be displayed due to an error.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};
