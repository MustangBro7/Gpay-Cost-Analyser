import type { NextConfig } from "next";

const defaultAllowedDevOrigins = ["local.app.gpayanalyze.co.in"];
const configuredAllowedDevOrigins = (process.env.NEXT_PUBLIC_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(
    new Set([...defaultAllowedDevOrigins, ...configuredAllowedDevOrigins])
  ),
};

export default nextConfig;
