/** DevSync v2 Next.js server configuration for Firebase-verified, MongoDB-backed Node.js routes. */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongodb", "firebase-admin"],
  typedRoutes: true,
};

export default nextConfig;
