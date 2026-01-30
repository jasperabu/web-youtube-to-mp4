#!/bin/bash
set -e

echo "🔧 Starting build process..."

# Check current directory
echo "📂 Current directory: $(pwd)"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install yt-dlp via pip
echo "📥 Installing yt-dlp via pip..."
pip install --break-system-packages -U yt-dlp

# Verify installation
echo "✅ Verifying yt-dlp installation..."
which yt-dlp
yt-dlp --version

echo "✨ Build complete!"