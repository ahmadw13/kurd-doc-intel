/** @type {import("next").NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendTarget = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8080";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;