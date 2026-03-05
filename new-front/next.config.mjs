// Default to the Docker service name so the standalone build nunca apunte a localhost
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://backend:5000';
// 'http://backend:5000' para el entorno de producción en Docker
// 'http://localhost:5000' para desarrollo local sin Docker

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl.replace(/\/$/, '')}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
