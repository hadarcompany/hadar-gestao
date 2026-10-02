/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["heic-convert"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig;
