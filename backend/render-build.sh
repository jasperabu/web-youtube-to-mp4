#!/bin/bash
set -e  # Exit on error

echo "🚀 YouTube to MP4 - Render Build Script"
echo "========================================"

# Function to check command availability
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install yt-dlp
echo ""
echo "📦 Installing yt-dlp..."

# Try multiple installation methods
if command_exists pip3; then
    echo "Using pip3..."
    pip3 install --user --upgrade yt-dlp
elif command_exists pip; then
    echo "Using pip..."
    pip install --user --upgrade yt-dlp
else
    echo "❌ Error: pip not found!"
    echo "Attempting to install pip..."
    
    # Try to get pip
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py --user
    rm get-pip.py
    
    # Retry installation
    pip3 install --user --upgrade yt-dlp
fi

# Add user bin to PATH
export PATH="$HOME/.local/bin:$PATH"
echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.bashrc

# Verify yt-dlp installation
echo ""
echo "🔍 Verifying yt-dlp installation..."
if command_exists yt-dlp; then
    YT_VERSION=$(yt-dlp --version)
    echo "✅ yt-dlp installed: v$YT_VERSION"
else
    echo "❌ yt-dlp not found in PATH"
    echo "Checking ~/.local/bin..."
    if [ -f "$HOME/.local/bin/yt-dlp" ]; then
        echo "✅ Found at: $HOME/.local/bin/yt-dlp"
        "$HOME/.local/bin/yt-dlp" --version
    else
        echo "❌ yt-dlp installation failed!"
        exit 1
    fi
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
if command_exists ffmpeg; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo "✅ $FFMPEG_VERSION"
else
    echo "⚠️  FFmpeg not found (optional)"
fi

echo ""
echo "========================================"
echo "✅ Build completed successfully!"
echo "========================================"