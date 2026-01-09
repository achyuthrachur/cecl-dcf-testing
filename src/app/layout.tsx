import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CECL DCF Testing',
  description: 'Discounted Cash Flow testing tool for CECL compliance',
  keywords: ['CECL', 'DCF', 'credit loss', 'financial', 'banking', 'compliance'],
  authors: [{ name: 'CECL DCF Testing' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
