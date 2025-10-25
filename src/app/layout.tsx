'use client';

import './globals.css';
import { siteMetadata, jsonLdData } from './metadata';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Basic Meta Tags */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Title and Description */}
        <title>{siteMetadata.title.default}</title>
        <meta name="description" content={siteMetadata.description} />
        <meta name="keywords" content={siteMetadata.keywords?.join(', ')} />

        {/* Open Graph Meta Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteMetadata.openGraph.url} />
        <meta property="og:title" content={siteMetadata.openGraph.title} />
        <meta property="og:description" content={siteMetadata.openGraph.description} />
        <meta property="og:image" content={siteMetadata.openGraph.images[0].url} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Yoga Pose Trainer" />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={siteMetadata.twitter.title} />
        <meta name="twitter:description" content={siteMetadata.twitter.description} />
        <meta name="twitter:image" content={siteMetadata.twitter.images[0]} />

        {/* Canonical URL */}
        <link rel="canonical" href={siteMetadata.alternates.canonical} />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Manifest for PWA */}
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
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Yoga Trainer" />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
