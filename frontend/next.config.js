/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'http', hostname: 'covers.openlibrary.org' },
    ],
    unoptimized: true,
  },
  output: 'standalone',
}

module.exports = nextConfig
