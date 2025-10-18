'use client';

import dynamic from 'next/dynamic';

const YogaPoseDetector = dynamic(() => import('./YogaPoseDetector'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-xl text-gray-600">Loading Yoga Pose Detector...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <YogaPoseDetector />;
}