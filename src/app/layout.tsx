import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Article Group | AI Concierge',
  description: 'Discover how Article Group can help solve your business challenges through personalized case studies and strategic insights.',
  keywords: ['brand strategy', 'creative agency', 'marketing', 'case studies', 'AI'],
  authors: [{ name: 'Article Group' }],
  openGraph: {
    title: 'Article Group | AI Concierge',
    description: 'Discover how Article Group can help solve your business challenges.',
    type: 'website',
    locale: 'en_US',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
