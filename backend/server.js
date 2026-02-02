import express from 'express';
import cors from 'cors';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Use system yt-dlp
const YTDLP_PATH = 'yt-dlp';

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://youtube-to-mp4-xta2.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Helper function to execute yt-dlp with multiple strategies
async function getVideoInfo(url, retryCount = 0) {
  const maxRetries = 3;
  
  // Strategy progression: each attempt tries a different approach
  const strategies = [
    {
      name: 'Android Mobile',
      args: [
        '--extractor-args', 'youtube:player_client=android',
        '--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip',
      ]
    },
    {
      name: 'iOS Mobile',
      args: [
        '--extractor-args', 'youtube:player_client=ios',
        '--user-agent', 'com.google.ios.youtube/19.09.3 (iPhone14,5; U; CPU iOS 15_6 like Mac OS X)',
      ]
    },
    {
      name: 'Android TV',
      args: [
        '--extractor-args', 'youtube:player_client=tv_embedded',
        '--user-agent', 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5) AppleWebKit/537.36',
      ]
    }
  ];

  const strategy = strategies[retryCount % strategies.length];
  console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries + 1} using strategy: ${strategy.name}`);

  const baseArgs = [
    url,
    '--dump-single-json',
    '--no-check-certificates',
    '--no-warnings',
    '--prefer-free-formats',
    '--add-header', 'accept-language:en-US,en;q=0.9',
    '--add-header', 'accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '--geo-bypass',
    '--no-call-home',
    '--no-check-certificate',
    ...strategy.args
  ];

  // Add delay between retries
  if (retryCount > 0) {
    const delay = Math.min(2000 * retryCount, 5000);
    console.log(`⏳ Waiting ${delay}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return new Promise((resolve, reject) => {
    const ytdlpProcess = spawn(YTDLP_PATH, baseArgs);
    let stdout = '';
    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error('yt-dlp stderr:', stderr);
        
        // Check if we should retry
        const shouldRetry = (
          stderr.includes('Sign in to confirm') || 
          stderr.includes('bot') ||
          stderr.includes('HTTP Error 403')
        ) && retryCount < maxRetries;

        if (shouldRetry) {
          console.log(`🔄 Retrying with different strategy (${retryCount + 1}/${maxRetries})...`);
          try {
            const result = await getVideoInfo(url, retryCount + 1);
            resolve(result);
          } catch (err) {
            reject(err);
          }
          return;
        }
        
        // Provide helpful error messages
        if (stderr.includes('Sign in to confirm') || stderr.includes('bot')) {
          reject(new Error('YouTube is blocking this request. This video may require authentication or may be temporarily unavailable. Try: 1) Wait a few minutes and try again, 2) Try a different video, 3) The video may be age-restricted.'));
        } else if (stderr.includes('Private video')) {
          reject(new Error('This video is private or unavailable.'));
        } else if (stderr.includes('Video unavailable')) {
          reject(new Error('Video unavailable. It may be deleted or region-restricted.'));
        } else if (stderr.includes('HTTP Error 403')) {
          reject(new Error('Access forbidden. YouTube may be rate limiting. Please wait 5 minutes and try again.'));
        } else if (stderr.includes('HTTP Error 429')) {
          reject(new Error('Too many requests. Please wait 10 minutes before trying again.'));
        } else {
          reject(new Error(`Unable to fetch video: ${stderr.substring(0, 200)}`));
        }
      } else {
        try {
          const json = JSON.parse(stdout);
          console.log(`✅ Successfully fetched video info using ${strategy.name}`);
          resolve(json);
        } catch (err) {
          reject(new Error(`Failed to parse video data: ${err.message}`));
        }
      }
    });

    ytdlpProcess.on('error', (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  });
}

// Rate limiting - simple in-memory store
const requestLog = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = requestLog.get(ip) || [];
  
  // Clean old requests
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  requestLog.set(ip, recentRequests);
  return true;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    version: '2.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'YouTube to MP4 API Running',
    version: '2.0',
    endpoints: ['/health', '/api/diagnostic', '/api/formats', '/api/download'],
    frontend: 'https://youtube-to-mp4-xta2.onrender.com',
    notes: 'Uses multiple strategies to bypass YouTube restrictions'
  });
});

// Diagnostic endpoint
app.get('/api/diagnostic', async (req, res) => {
  try {
    const diagnostics = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ytdlpConfiguredPath: YTDLP_PATH,
      cors: 'enabled',
      allowedOrigins: [
        'https://youtube-to-mp4-xta2.onrender.com',
        'http://localhost:5173',
        'http://localhost:3000'
      ],
      rateLimit: {
        window: `${RATE_LIMIT_WINDOW / 1000}s`,
        maxRequests: MAX_REQUESTS_PER_WINDOW
      }
    };

    // Check yt-dlp
    try {
      const { stdout: ytdlpVersion } = await execPromise('yt-dlp --version');
      diagnostics.ytdlpVersion = ytdlpVersion.trim();
      diagnostics.ytdlpStatus = 'installed';
      
      const { stdout: ytdlpPath } = await execPromise('which yt-dlp');
      diagnostics.ytdlpPath = ytdlpPath.trim();
    } catch (err) {
      diagnostics.ytdlpStatus = 'not found';
      diagnostics.ytdlpError = err.message;
    }

    // Check ffmpeg
    try {
      const { stdout: ffmpegVersion } = await execPromise('ffmpeg -version | head -n 1');
      diagnostics.ffmpegVersion = ffmpegVersion.trim();
      diagnostics.ffmpegStatus = 'installed';
    } catch (err) {
      diagnostics.ffmpegStatus = 'not found';
      diagnostics.ffmpegError = err.message;
    }

    res.json(diagnostics);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Test endpoint
app.get('/api/test-ytdlp', async (req, res) => {
  try {
    console.log('Testing yt-dlp...');
    
    // Use a simple, reliable test video
    const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    
    const output = await getVideoInfo(testUrl);

    res.json({
      success: true,
      title: output.title,
      duration: output.duration,
      formatCount: output.formats ? output.formats.length : 0,
      message: 'yt-dlp is working correctly'
    });
  } catch (err) {
    console.error('yt-dlp test error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      suggestion: 'Try updating yt-dlp: pip install --upgrade yt-dlp'
    });
  }
});

// Get available video formats
app.get('/api/formats', async (req, res) => {
  try {
    const { url } = req.query;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ 
        error: 'Too many requests. Please wait a moment and try again.',
        retryAfter: 60 
      });
    }

    console.log(`📥 Fetching formats for: ${url}`);
    console.log(`   Client IP: ${clientIp}`);

    const output = await getVideoInfo(url);

    // Separate video and audio formats
    const videoFormats = output.formats
      .filter(f => f.vcodec !== 'none' && f.height)
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        quality: f.height,
        resolution: f.resolution || `${f.width}x${f.height}`,
        filesize: f.filesize,
        fps: f.fps,
        vcodec: f.vcodec,
        acodec: f.acodec
      }))
      .reduce((acc, curr) => {
        const existing = acc.find(f => f.quality === curr.quality);
        if (!existing || (curr.filesize && (!existing.filesize || curr.filesize > existing.filesize))) {
          return [...acc.filter(f => f.quality !== curr.quality), curr];
        }
        return acc;
      }, [])
      .sort((a, b) => b.quality - a.quality)
      .slice(0, 10);

    const audioFormats = output.formats
      .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        abr: f.abr,
        filesize: f.filesize,
        acodec: f.acodec
      }))
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))
      .slice(0, 5);

    const subtitles = output.subtitles || {};
    const automaticCaptions = output.automatic_captions || {};

    res.json({
      title: output.title,
      thumbnail: output.thumbnail,
      duration: output.duration_string || `${Math.floor(output.duration / 60)}:${String(output.duration % 60).padStart(2, '0')}`,
      formats: videoFormats,
      audio: audioFormats,
      subtitles: { ...subtitles, ...automaticCaptions }
    });

    console.log(`✅ Successfully returned ${videoFormats.length} video formats and ${audioFormats.length} audio formats`);

  } catch (error) {
    console.error('❌ Error fetching formats:', error);
    
    res.status(500).json({ 
      error: 'Failed to fetch video formats',
      details: error.message,
      suggestion: error.message.includes('blocking') 
        ? 'YouTube is temporarily blocking requests. Please wait 5 minutes and try again, or try a different video.'
        : 'Please try again or try a different video.'
    });
  }
});

// Download endpoint
app.get('/api/download', async (req, res) => {
  try {
    const { url, format_id, type } = req.query;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ 
        error: 'Too many requests. Please wait a moment and try again.',
        retryAfter: 60 
      });
    }

    console.log(`📥 Download request: ${type} (${format_id})`);
    console.log(`   URL: ${url}`);
    console.log(`   Client IP: ${clientIp}`);

    // Get video info for filename
    const info = await getVideoInfo(url);
    const sanitizedTitle = info.title.replace(/[^\w\s-]/gi, '_').substring(0, 100);
    
    let filename, formatArg;
    
    if (type === 'audio') {
      filename = `${sanitizedTitle}.mp3`;
      formatArg = format_id || 'bestaudio';
    } else {
      filename = `${sanitizedTitle}.mp4`;
      if (format_id) {
        formatArg = `${format_id}+bestaudio/best`;
      } else {
        formatArg = 'bestvideo+bestaudio/best';
      }
    }
    
    console.log(`   Format: ${formatArg}`);
    console.log(`   Filename: ${filename}`);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');

    const args = [
      url,
      '--format', formatArg,
      '--output', '-',
      '--no-check-certificates',
      '--no-warnings',
      '--quiet',
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip',
      '--add-header', 'accept-language:en-US,en',
      '--geo-bypass'
    ];

    if (type === 'audio') {
      args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0');
    } else {
      args.push('--merge-output-format', 'mp4');
    }

    console.log('🚀 Starting download...');

    const ytdlpProcess = spawn(YTDLP_PATH, args);
    
    ytdlpProcess.stdout.pipe(res);
    
    ytdlpProcess.stderr.on('data', (data) => {
      console.error('yt-dlp stderr:', data.toString());
    });
    
    ytdlpProcess.on('error', (error) => {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed', details: error.message });
      }
    });

    ytdlpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Download failed with code: ${code}`);
      } else {
        console.log('✅ Download completed successfully');
      }
    });

  } catch (error) {
    console.error('❌ Error in download:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Download failed',
        details: error.message,
        suggestion: 'Please try again or try a different video.'
      });
    }
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Check for required dependencies on startup
async function checkDependencies() {
  console.log('\n=== Checking Dependencies ===\n');
  
  try {
    const { stdout } = await execPromise('ffmpeg -version | head -n 1');
    console.log('✅ FFmpeg:', stdout.trim());
  } catch (error) {
    console.warn('⚠️  FFmpeg not found (optional)');
  }

  try {
    const { stdout: version } = await execPromise('yt-dlp --version');
    const { stdout: pathOutput } = await execPromise('which yt-dlp');
    console.log('✅ yt-dlp:', version.trim());
    console.log('   Path:', pathOutput.trim());
  } catch (error) {
    console.error('❌ yt-dlp not found!');
    console.error('   Please install: pip install yt-dlp');
    process.exit(1);
  }

  console.log('\n=========================\n');
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend: https://youtube-to-mp4-xta2.onrender.com`);
  console.log(`🔧 Backend: https://web-youtube-to-mp4.onrender.com`);
  console.log(`✅ CORS enabled`);
  console.log(`🛡️  Rate limiting: ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW / 1000}s`);
  await checkDependencies();
  console.log('🎯 Server ready!\n');
});