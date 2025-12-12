import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Вывод для Docker standalone сборки
  output: 'standalone',
  
  // Включаем Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Разрешаем изображения из Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
