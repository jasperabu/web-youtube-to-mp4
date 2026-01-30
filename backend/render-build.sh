#!/usr/bin/env bash
# Exit on error
set -e

echo "📦 Installing npm dependencies..."
npm install

echo "📥 Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /opt/render/project/src/yt-dlp

echo "🔧 Making yt-dlp executable..."
chmod a+rx /opt/render/project/src/yt-dlp

echo "✅ yt-dlp installed successfully!"

# Verify installation
if [ -f "/opt/render/project/src/yt-dlp" ]; then
    echo "✓ yt-dlp binary found at /opt/render/project/src/yt-dlp"
else
    echo "❌ ERROR: yt-dlp binary not found!"
    exit 1
fi