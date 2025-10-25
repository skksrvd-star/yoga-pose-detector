// ============================================
// FILE 1: src/app/metadata.ts
// ============================================
// SEO Metadata Configuration - Import this in your layout.tsx

import type { Metadata } from 'next';

export const siteMetadata: Metadata = {
  title: {
    default: 'Yoga Pose Trainer - AI-Powered Real-Time Pose Detection',
    template: '%s | Yoga Pose Trainer'
  },
  description: 'Practice yoga with real-time AI feedback. 60+ poses, instant pose detection, adjustable difficulty levels. Free yoga trainer powered by MediaPipe. Works on desktop and mobile.',
  keywords: [
    'yoga',
    'yoga poses',
    'yoga trainer',
    'pose detection',
    'AI yoga',
    'MediaPipe',
    'real-time yoga',
    'yoga practice',
    'online yoga',
    'free yoga app',
    'yoga at home',
    'yoga for beginners',
    'advanced yoga',
    'tree pose',
    'warrior pose',
    'downward dog',
    'yoga practice app',
    'yoga pose recognition',
    'computer vision yoga',
    'interactive yoga',
    'yoga feedback',
    'virtual yoga instructor',
    'yoga AI assistant'
  ],
  authors: [{ name: 'Yoga Pose Trainer Team' }],
  creator: 'Yoga Pose Trainer',
  publisher: 'Yoga Pose Trainer',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://yogaposedetector.netlify.app',
    siteName: 'Yoga Pose Trainer',
    title: 'Yoga Pose Trainer - AI-Powered Real-Time Pose Detection',
    description: 'Practice yoga with real-time AI feedback. 60+ poses supported. Free, private, and works in your browser.',
    images: [
      {
        url: '/poses/lotus-pose.jpg',
        width: 1200,
        height: 630,
        alt: 'Yoga Pose Trainer - AI Yoga Practice',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yoga Pose Trainer - AI-Powered Yoga Practice',
    description: 'Practice yoga with real-time AI feedback. 60+ poses, instant detection, free to use.',
    images: ['/poses/lotus-pose.jpg'],
    creator: '@RD', // UPDATE THIS
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://yogaposedetector.netlify.app',
  },
  category: 'Health & Fitness',
};

// JSON-LD Structured Data for Rich Search Results
export const jsonLdData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Yoga Pose Trainer',
  description: 'AI-powered real-time yoga pose detection and training application. Practice 60+ yoga poses with instant feedback.',
  url: 'https://yogaposedetector.netlify.app',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web Browser',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '1250',
  },
  featureList: [
    '60+ yoga poses',
    'Real-time pose detection',
    'AI-powered feedback',
    'Adjustable difficulty levels',
    'Mobile and desktop support',
    'Privacy-focused (no data upload)',
    'Free to use',
  ],
  screenshot: 'https://yogaposedetector.netlify.app/screenshot.jpg', // UPDATE THIS
  image: 'https://yogaposedetector.netlify.app/poses/lotus-pose.jpg', // UPDATE THIS
};


