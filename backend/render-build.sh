#!/bin/bash

# YouTube Cookies Validation Script
# This script helps you validate your YouTube cookies setup

echo "🔍 YouTube Cookies Validation Script"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if cookies file exists
COOKIES_FILE="youtube_cookies.txt"

if [ -f "$COOKIES_FILE" ]; then
    echo -e "${GREEN}✅ Cookies file found: $COOKIES_FILE${NC}"
    
    # Check file size
    FILE_SIZE=$(wc -c < "$COOKIES_FILE")
    if [ $FILE_SIZE -lt 100 ]; then
        echo -e "${RED}❌ Warning: Cookie file seems too small ($FILE_SIZE bytes)${NC}"
        echo "   Expected at least 100 bytes"
    else
        echo -e "${GREEN}✅ File size looks good: $FILE_SIZE bytes${NC}"
    fi
    
    # Check file format
    if head -n 1 "$COOKIES_FILE" | grep -q "Netscape HTTP Cookie File"; then
        echo -e "${GREEN}✅ File format is correct (Netscape format)${NC}"
    else
        echo -e "${RED}❌ Warning: File may not be in Netscape format${NC}"
        echo "   First line should contain: # Netscape HTTP Cookie File"
    fi
    
    # Count cookie entries
    COOKIE_COUNT=$(grep -v "^#" "$COOKIES_FILE" | grep -v "^$" | wc -l)
    echo -e "${GREEN}✅ Found $COOKIE_COUNT cookie entries${NC}"
    
    if [ $COOKIE_COUNT -lt 5 ]; then
        echo -e "${YELLOW}⚠️  Warning: Very few cookies found. You may need to re-export.${NC}"
    fi
    
    # Check for important YouTube cookies
    echo ""
    echo "🔍 Checking for important cookies:"
    
    if grep -q "LOGIN_INFO" "$COOKIES_FILE"; then
        echo -e "${GREEN}  ✅ LOGIN_INFO found (authentication)${NC}"
    else
        echo -e "${YELLOW}  ⚠️  LOGIN_INFO not found (you may not be logged in)${NC}"
    fi
    
    if grep -q "VISITOR_INFO" "$COOKIES_FILE"; then
        echo -e "${GREEN}  ✅ VISITOR_INFO found (tracking)${NC}"
    else
        echo -e "${YELLOW}  ⚠️  VISITOR_INFO not found${NC}"
    fi
    
    if grep -q "CONSENT" "$COOKIES_FILE"; then
        echo -e "${GREEN}  ✅ CONSENT found (GDPR)${NC}"
    else
        echo -e "${YELLOW}  ⚠️  CONSENT not found${NC}"
    fi
    
    # Check file permissions
    echo ""
    echo "🔒 Checking file permissions:"
    PERMS=$(stat -c "%a" "$COOKIES_FILE" 2>/dev/null || stat -f "%OLp" "$COOKIES_FILE" 2>/dev/null)
    if [ "$PERMS" = "644" ] || [ "$PERMS" = "600" ]; then
        echo -e "${GREEN}✅ Permissions are good: $PERMS${NC}"
    else
        echo -e "${YELLOW}⚠️  Permissions: $PERMS (recommended: 644 or 600)${NC}"
        echo "   Fix with: chmod 644 $COOKIES_FILE"
    fi
    
    # Test with yt-dlp if available
    echo ""
    echo "🧪 Testing cookies with yt-dlp:"
    if command -v yt-dlp &> /dev/null; then
        TEST_URL="https://www.youtube.com/watch?v=jNQXAC9IVRw"
        echo "   Testing with: $TEST_URL"
        
        if yt-dlp --cookies "$COOKIES_FILE" --skip-download --print title "$TEST_URL" &> /dev/null; then
            echo -e "${GREEN}✅ yt-dlp successfully used cookies${NC}"
        else
            echo -e "${RED}❌ yt-dlp failed to use cookies${NC}"
            echo "   Try refreshing your cookies"
        fi
    else
        echo -e "${YELLOW}⚠️  yt-dlp not installed, skipping test${NC}"
        echo "   Install with: pip install yt-dlp"
    fi
    
else
    echo -e "${RED}❌ Cookies file not found: $COOKIES_FILE${NC}"
    echo ""
    echo "📋 How to create cookies file:"
    echo "   1. Install browser extension: 'Get cookies.txt LOCALLY'"
    echo "   2. Go to YouTube and login"
    echo "   3. Click extension icon and export"
    echo "   4. Save as: $COOKIES_FILE"
    echo ""
    echo "   See COOKIES_GUIDE.md for detailed instructions"
fi

echo ""
echo "====================================="
echo "Validation complete!"