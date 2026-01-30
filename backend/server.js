import express from 'express';
import cors from 'cors';
import ytdlp from 'yt-dlp-exec';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure yt-dlp to use the system-installed binary
const ytdlpPath = '/opt/render/project/src/.venv/bin/yt-dlp';

// Wrapper function to use system yt-dlp
const ytdlpExec = (url, options = {}) => {
  return ytdlp(url, {
    ...options,
    ytdlpPath: ytdlpPath
  });
};

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
    };

    // Check yt-dlp
    try {
      const { stdout: ytdlpPath } = await execPromise('which yt-dlp');
      diagnostics.ytdlpPath = ytdlpPath.trim();
      
      const { stdout: ytdlpVersion } = await execPromise('yt-dlp --version');
      diagnostics.ytdlpVersion = ytdlpVersion.trim();
      diagnostics.ytdlpStatus = 'installed';
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
    console.log('Using yt-dlp at:', ytdlpPath);
    
    const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Short "Me at the zoo" video
    
    const output = await ytdlpExec(testUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
    });

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
      error: err.message,
      stderr: err.stderr,
      stdout: err.stdout
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

    const output = await ytdlpExec(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    });

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
    console.error('Error details:', {
      message: error.message,
      stderr: error.stderr,
      stdout: error.stdout
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch video formats',
      details: error.message,
      stderr: error.stderr
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
    const info = await ytdlpExec(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true
    });

    const filename = `${info.title.replace(/[^\w\s-]/gi, '_').substring(0, 100)}.mp4`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    const options = {
      format: format_id || 'best',
      output: '-',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    };

    const ytdlpProcess = ytdlpExec(url, options);
    
    ytdlpProcess.stdout.pipe(res);
    
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