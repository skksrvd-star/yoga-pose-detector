/** @type {import('next').NextConfig} */
let withPWA = (config) => config;

try {
  const nextPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
  });
  withPWA = nextPWA;
} catch (e) {
  console.warn('next-pwa not installed, skipping PWA setup');
}

module.exports = withPWA({
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
});
