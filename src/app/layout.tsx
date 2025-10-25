'use client';

import './globals.css';
import { siteMetadata, jsonLdData } from './metadata';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fallback-safe access
  const title = siteMetadata?.title && typeof siteMetadata.title === 'object'
    ? siteMetadata.title.default ?? 'Yoga Pose Trainer'
    : (siteMetadata?.title as string) ?? 'Yoga Pose Trainer';

  const description =
    siteMetadata?.description ??
    'AI-powered real-time yoga pose detection and training application.';

  const keywords =
    siteMetadata?.keywords?.join(', ') ??
    'yoga, AI yoga, pose detection, fitness';

  const og = siteMetadata?.openGraph ?? {};
  const twitter = siteMetadata?.twitter ?? {};
  const canonical = siteMetadata?.alternates?.canonical ?? '/';

  return (
    <html lang="en">
      <head>
        {/* Basic Meta Tags */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Title and Description */}
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />

        {/* Open Graph Meta Tags */}
        <meta property="og:type" content={og.type ?? 'website'} />
        <meta property="og:url" content={og.url ?? canonical} />
        <meta property="og:title" content={og.title ?? title} />
        <meta property="og:description" content={og.description ?? description} />
        <meta
          property="og:image"
          content={og.images?.[0]?.url ?? '/poses/lotus-pose.jpg'}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content={og.siteName ?? 'Yoga Pose Trainer'} />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={twitter.title ?? title} />
        <meta name="twitter:description" content={twitter.description ?? description} />
        <meta
          name="twitter:image"
          content={twitter.images?.[0] ?? '/poses/lotus-pose.jpg'}
        />

        {/* Canonical URL */}
        <link rel="canonical" href={canonical} />

        {/* Favicon and Manifest */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Theme Color */}
        <meta name="theme-color" content="#9333ea" />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdData),
          }}
        />

        {/* Additional Meta Tags */}
        <meta name="author" content="Yoga Pose Trainer Team" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="revisit-after" content="7 days" />
        <meta name="category" content="Health & Fitness" />

        {/* Mobile Optimization */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Yoga Trainer" />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
