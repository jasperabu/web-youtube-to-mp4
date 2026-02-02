#!/bin/bash
set -e  # Exit on error

echo "🚀 YouTube to MP4 - Render Build Script"
echo "========================================"

# Install yt-dlp (without --user since Render uses virtualenv)
echo ""
echo "📦 Installing yt-dlp..."

# Install directly (no --user flag in virtualenv)
if command -v pip3 &> /dev/null; then
    echo "Using pip3..."
    pip3 install yt-dlp
elif command -v pip &> /dev/null; then
    echo "Using pip..."
    pip install yt-dlp
else
    echo "❌ Error: pip not found!"
    exit 1
fi

# Verify yt-dlp installation
echo ""
echo "🔍 Verifying yt-dlp installation..."
if command -v yt-dlp &> /dev/null; then
    YT_VERSION=$(yt-dlp --version)
    echo "✅ yt-dlp installed: v$YT_VERSION"
    YT_PATH=$(which yt-dlp)
    echo "✅ yt-dlp path: $YT_PATH"
else
    echo "❌ yt-dlp not found in PATH"
    exit 1
fi

# Install Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
cd backend

if [ -f "package.json" ]; then
    npm ci --production || npm install --production
    echo "✅ Node.js dependencies installed"
else
    echo "❌ package.json not found!"
    exit 1
fi

# Check for cookies
echo ""
echo "🔍 Checking for YouTube cookies..."
if [ -f "youtube_cookies.txt" ]; then
    FILE_SIZE=$(wc -c < "youtube_cookies.txt")
    echo "✅ Cookies file found ($FILE_SIZE bytes)"
    chmod 644 youtube_cookies.txt
    
    # Quick validation
    if head -n 1 "youtube_cookies.txt" | grep -q "Netscape"; then
        echo "✅ Cookie format looks correct"
    else
        echo "⚠️  Warning: Cookie file may be invalid"
    fi
else
    echo "ℹ️  No cookies file found (optional)"
    echo "   Add cookies for better reliability"
fi

# Verify FFmpeg
echo ""
echo "🔍 Checking FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo "✅ $FFMPEG_VERSION"
else
    echo "⚠️  FFmpeg not found (optional)"
fi

echo ""
echo "========================================"
echo "✅ Build completed successfully!"
echo "========================================"