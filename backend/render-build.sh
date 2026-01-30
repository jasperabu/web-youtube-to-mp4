#!/bin/bash
set -e

echo "🔧 Starting build process..."

# Install dependencies
echo "📦 Installing npm dependencies..."
cd backend
npm install

# Install yt-dlp via pip (more reliable on Render)
echo "📥 Installing yt-dlp via pip..."
pip install --break-system-packages yt-dlp

# Verify installation
echo "✅ Verifying yt-dlp installation..."
which yt-dlp
yt-dlp --version

echo "✨ Build complete!"