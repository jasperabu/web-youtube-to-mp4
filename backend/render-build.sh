#!/usr/bin/env bash
# Install FFmpeg
apt-get update
apt-get install -y ffmpeg

# Install node dependencies
npm install
```

Then update your Render build command to:
```
bash render-build.sh