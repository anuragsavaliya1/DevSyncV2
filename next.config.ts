/** DevSync v2 Next.js server configuration for Firebase-verified, MongoDB-backed Node.js routes. */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongodb", "firebase-admin"],
  typedRoutes: true,
  allowedDevOrigins: ["3000-it25cf44ppm9qho4ebqnv-95cf2949.us4.manus.computer", "127.0.0.1", "localhost"],
};

export default nextConfig;
