/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',       // where the service worker will be generated
  register: true,       // automatically register the service worker
  skipWaiting: true,    // activate new SW immediately
  disable: process.env.NODE_ENV === 'development', // disable PWA in dev
})

const nextConfig = withPWA({
  reactStrictMode: true,
  images: {
    unoptimized: true,  // keeps your current behavior for images
  },
  // Optional: if you want to use experimental features
  // experimental: {
  //   appDir: true,
  // },
})

module.exports = nextConfig;
