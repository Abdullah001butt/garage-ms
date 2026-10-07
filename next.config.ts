import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Lets <ViewTransition> animate route changes (job card → job page morphs).
    viewTransition: true,
  },
};

export default nextConfig;
