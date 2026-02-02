import express from 'express';
import cors from 'cors';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Use system yt-dlp
const YTDLP_PATH = 'yt-dlp';

// 🔥 FIXED: Better CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://youtube-to-mp4-xta2.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    // Allow requests with no origin (mobile apps, Postman, etc.)
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

// Apply CORS BEFORE other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());

// Serve static files from frontend (if needed for same-domain deployment)
app.use(express.static(path.join(__dirname, '../frontend')));

// Helper function to execute yt-dlp with JSON output
async function getVideoInfo(url, extraArgs = []) {
  const args = [
    url,
    '--dump-single-json',
    '--no-check-certificates',
    '--no-warnings',
    '--prefer-free-formats',
    // 🔥 IMPROVED: Better bot detection bypass
    '--extractor-args', 'youtube:player_client=android,ios,web',
    '--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip',
    '--add-header', 'accept-language:en-US,en',
    '--geo-bypass',
    '--sleep-interval', '1',
    '--max-sleep-interval', '3',
    ...extraArgs
  ];

  return new Promise((resolve, reject) => {
    const ytdlpProcess = spawn(YTDLP_PATH, args);
    let stdout = '';
    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp stderr:', stderr);
        
        // Provide helpful error messages
        if (stderr.includes('Sign in to confirm') || stderr.includes('bot')) {
          reject(new Error('YouTube bot detection triggered. Please try again in a moment, or try a different video.'));
        } else if (stderr.includes('Private video')) {
          reject(new Error('This video is private or unavailable.'));
        } else if (stderr.includes('Video unavailable')) {
          reject(new Error('Video unavailable. It may be deleted or region-restricted.'));
        } else if (stderr.includes('HTTP Error 403')) {
          reject(new Error('Access forbidden. YouTube may be rate limiting. Please wait a moment and try again.'));
        } else {
          reject(new Error(`yt-dlp error: ${stderr.substring(0, 200)}`));
        }
      } else {
        try {
          const json = JSON.parse(stdout);
          resolve(json);
        } catch (err) {
          reject(new Error(`Failed to parse JSON: ${err.message}`));
        }
      }
    });

    ytdlpProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'YouTube to MP4 API Running',
    endpoints: ['/health', '/api/diagnostic', '/api/formats', '/api/download'],
    frontend: 'https://youtube-to-mp4-xta2.onrender.com',
    cors: 'enabled'
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
      ]
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

// Test yt-dlp directly
app.get('/api/test-ytdlp', async (req, res) => {
  try {
    console.log('Testing yt-dlp with a simple video...');
    console.log('Using yt-dlp command:', YTDLP_PATH);
    
    const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Short "Me at the zoo" video
    
    const output = await getVideoInfo(testUrl);

    res.json({
      success: true,
      title: output.title,
      duration: output.duration,
      formatCount: output.formats ? output.formats.length : 0
    });
  } catch (err) {
    console.error('yt-dlp test error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get available video formats
app.get('/api/formats', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('Fetching formats for:', url);

    const output = await getVideoInfo(url);

    // Separate video and audio formats
    const videoFormats = output.formats
      .filter(f => f.vcodec !== 'none' && f.height) // Has video
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
      // Remove duplicates by quality, keep best format for each quality
      .reduce((acc, curr) => {
        const existing = acc.find(f => f.quality === curr.quality);
        if (!existing || (curr.filesize && (!existing.filesize || curr.filesize > existing.filesize))) {
          return [...acc.filter(f => f.quality !== curr.quality), curr];
        }
        return acc;
      }, [])
      .sort((a, b) => b.quality - a.quality)
      .slice(0, 10); // Limit to top 10 formats

    const audioFormats = output.formats
      .filter(f => f.acodec !== 'none' && f.vcodec === 'none') // Audio only
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        abr: f.abr,
        filesize: f.filesize,
        acodec: f.acodec
      }))
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))
      .slice(0, 5); // Limit to top 5 audio formats

    // Extract subtitles
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

  } catch (error) {
    console.error('Error fetching formats:', error);
    
    res.status(500).json({ 
      error: 'Failed to fetch video formats',
      details: error.message
    });
  }
});

// Download endpoint
app.get('/api/download', async (req, res) => {
  try {
    const { url, format_id, type } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Download request:', { url, format_id, type });

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
    
    console.log('Using format:', formatArg);
    console.log('Filename:', filename);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');

    const args = [
      url,
      '--format', formatArg,
      '--output', '-', // Output to stdout
      '--no-check-certificates',
      '--no-warnings',
      '--quiet',
      // 🔥 Use Android client for downloads too
      '--extractor-args', 'youtube:player_client=android,ios,web',
      '--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip',
      '--add-header', 'accept-language:en-US,en',
      '--geo-bypass'
    ];

    // Add audio conversion if needed
    if (type === 'audio') {
      args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0');
    } else {
      args.push('--merge-output-format', 'mp4');
    }

    console.log('Spawning yt-dlp for download...');

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
        console.error('yt-dlp exited with code:', code);
      } else {
        console.log('Download completed successfully');
      }
    });

  } catch (error) {
    console.error('Error in download:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Download failed',
        details: error.message 
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
  
  // Check FFmpeg
  try {
    const { stdout } = await execPromise('ffmpeg -version | head -n 1');
    console.log('✅ FFmpeg:', stdout.trim());
  } catch (error) {
    console.warn('⚠️  FFmpeg not found (optional, but recommended)');
  }

  // Check yt-dlp
  try {
    const { stdout: version } = await execPromise('yt-dlp --version');
    const { stdout: pathOutput } = await execPromise('which yt-dlp');
    console.log('✅ yt-dlp:', version.trim());
    console.log('   Path:', pathOutput.trim());
  } catch (error) {
    console.error('❌ yt-dlp not found!');
    console.error('   Error:', error.message);
    console.error('   Please install: pip install yt-dlp');
    process.exit(1);
  }

  console.log('\n=========================\n');
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend URL: https://youtube-to-mp4-xta2.onrender.com`);
  console.log(`🔧 Backend URL: https://web-youtube-to-mp4.onrender.com`);
  console.log(`✅ CORS enabled for frontend`);
  await checkDependencies();
  console.log('🎯 Server ready!\n');
});