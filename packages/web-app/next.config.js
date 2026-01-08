const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    // Exclude VS Code modules from webpack bundle (only needed for VS Code extension)
    if (isServer) {
      // Ignore vscode module completely
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^vscode$/,
        })
      );
      
      // Ignore fileScanner module that requires vscode
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /fileScanner/,
          contextRegExp: /@codeatlas\/core/,
        })
      );
      
      // Set externals for vscode
      config.externals = config.externals || [];
      config.externals.push({
        'vscode': 'commonjs vscode',
      });
    }
    
    // Set fallback for vscode (for client-side)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      vscode: false,
    };
    
    return config;
  },
}

module.exports = nextConfig

