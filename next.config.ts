import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * better-sqlite3 is a native module. Bundling it would break the .node
   * binary, so Next must require it at runtime instead.
   */
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
