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

// Configure yt-dlp to use the system-installed binary
const YTDLP_PATH = '/opt/render/project/src/.venv/bin/yt-dlp';

// Helper function to execute yt-dlp with JSON output
async function getVideoInfo(url, extraArgs = []) {
  const args = [
    url,
    '--dump-single-json',
    '--no-check-certificates',
    '--no-warnings',
    '--prefer-free-formats',
    '--add-header', 'referer:youtube.com',
    '--add-header', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...extraArgs
  ];

  return new Promise((resolve, reject) => {
    const process = spawn(YTDLP_PATH, args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      } else {
        try {
          const json = JSON.parse(stdout);
          resolve(json);
        } catch (err) {
          reject(new Error(`Failed to parse JSON: ${err.message}`));
        }
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint
app.get('/api/diagnostic', async (req, res) => {
  try {
    const diagnostics = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ytdlpConfiguredPath: YTDLP_PATH,
    };

    // Check if configured yt-dlp exists
    try {
      const { stdout: ytdlpVersion } = await execPromise(`${YTDLP_PATH} --version`);
      diagnostics.ytdlpVersion = ytdlpVersion.trim();
      diagnostics.ytdlpStatus = 'installed';
    } catch (err) {
      diagnostics.ytdlpStatus = 'not found at configured path';
      diagnostics.ytdlpError = err.message;
    }

    // Check system yt-dlp
    try {
      const { stdout: ytdlpPath } = await execPromise('which yt-dlp');
      diagnostics.systemYtdlpPath = ytdlpPath.trim();
    } catch (err) {
      diagnostics.systemYtdlpPath = 'not in PATH';
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
    console.log('Using yt-dlp at:', YTDLP_PATH);
    
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

    // Filter for formats with both video and audio
    const formats = output.formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        resolution: f.resolution || `${f.width}x${f.height}`,
        filesize: f.filesize,
        quality: f.quality,
        fps: f.fps,
        vcodec: f.vcodec,
        acodec: f.acodec
      }))
      .sort((a, b) => {
        const getHeight = (res) => {
          const match = res.match(/\d+/);
          return match ? parseInt(match[0]) : 0;
        };
        return getHeight(b.resolution) - getHeight(a.resolution);
      });

    res.json({
      title: output.title,
      thumbnail: output.thumbnail,
      duration: output.duration,
      formats: formats
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
app.post('/api/download', async (req, res) => {
  try {
    const { url, format_id } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Downloading:', url, 'Format:', format_id);

    // Get video info for filename
    const info = await getVideoInfo(url);

    const filename = `${info.title.replace(/[^\w\s-]/gi, '_').substring(0, 100)}.mp4`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    const args = [
      url,
      '--format', format_id || 'best',
      '--output', '-',
      '--no-check-certificates',
      '--no-warnings',
      '--prefer-free-formats',
      '--add-header', 'referer:youtube.com',
      '--add-header', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ];

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
    console.error('❌ FFmpeg not found');
  }

  // Check yt-dlp
  try {
    const { stdout: pathOutput } = await execPromise('which yt-dlp');
    const { stdout: version } = await execPromise('yt-dlp --version');
    console.log('✅ yt-dlp:', version.trim());
    console.log('   Path:', pathOutput.trim());
  } catch (error) {
    console.error('❌ yt-dlp not found');
    console.error('   Error:', error.message);
  }

  console.log('\n=========================\n');
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await checkDependencies();
  console.log('🎯 Server ready!\n');
});