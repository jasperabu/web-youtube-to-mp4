#!/bin/bash
set -e

echo "🔧 Starting build process..."

# Check current directory
echo "📂 Current directory: $(pwd)"
echo "📂 Directory contents:"
ls -la

# Install dependencies (we're already in the backend directory on Render)
echo "📦 Installing npm dependencies..."
npm install

# Install yt-dlp via pip (more reliable on Render)
echo "📥 Installing yt-dlp via pip..."
pip install --break-system-packages yt-dlp

# Verify installation
echo "✅ Verifying yt-dlp installation..."
which yt-dlp
yt-dlp --version

echo "✨ Build complete!"