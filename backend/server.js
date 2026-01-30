const express = require('express');
const cors = require('cors');
const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const execPromise = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure yt-dlp binary path
const YTDLP_BINARY = process.env.YTDLP_PATH || '/opt/render/project/src/yt-dlp';

// Wrapper function for yt-dlp that uses the binary path
const ytdlpExec = (url, options = {}) => {
  return ytdlp(url, {
    ...options,
    binaryPath: YTDLP_BINARY
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

// Diagnostic endpoint to check yt-dlp installation
app.get('/api/diagnostic', async (req, res) => {
  try {
    const diagnostics = {
      binaryPath: YTDLP_BINARY,
      binaryExists: fs.existsSync(YTDLP_BINARY),
      binaryExecutable: false,
      version: null,
      error: null
    };

    // Check if file is executable
    try {
      const stats = fs.statSync(YTDLP_BINARY);
      diagnostics.binaryExecutable = !!(stats.mode & fs.constants.S_IXUSR);
      diagnostics.fileMode = stats.mode.toString(8);
    } catch (err) {
      diagnostics.error = `Stat error: ${err.message}`;
    }

    // Try to get version
    try {
      const { stdout } = await execPromise(`${YTDLP_BINARY} --version`);
      diagnostics.version = stdout.trim();
    } catch (err) {
      diagnostics.versionError = err.message;
    }

    // Check alternative locations
    const altLocations = [
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      './yt-dlp',
      'yt-dlp'
    ];
    
    diagnostics.alternativeLocations = {};
    for (const loc of altLocations) {
      diagnostics.alternativeLocations[loc] = fs.existsSync(loc);
    }

    // Try which yt-dlp
    try {
      const { stdout } = await execPromise('which yt-dlp');
      diagnostics.whichYtdlp = stdout.trim();
    } catch (err) {
      diagnostics.whichYtdlp = 'not found in PATH';
    }

    res.json(diagnostics);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    console.log('Using yt-dlp binary at:', YTDLP_BINARY);

    const output = await ytdlpExec(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0'
      ]
    });

    const formats = output.formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        resolution: f.resolution || `${f.width}x${f.height}`,
        filesize: f.filesize,
        quality: f.quality
      }))
      .sort((a, b) => {
        const resA = parseInt(a.resolution);
        const resB = parseInt(b.resolution);
        return resB - resA;
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

    const options = {
      format: format_id || 'best',
      output: '-',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0'
      ]
    };

    // Get video info for filename
    const info = await ytdlpExec(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true
    });

    const filename = `${info.title.replace(/[^\w\s]/gi, '')}.mp4`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    const ytdlpProcess = ytdlpExec(url, options);
    
    ytdlpProcess.stdout.pipe(res);
    
    ytdlpProcess.on('error', (error) => {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
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

// Check for required dependencies
async function checkDependencies() {
  console.log('\n=== Checking Dependencies ===');
  
  // Check FFmpeg
  try {
    const { stdout } = await execPromise('ffmpeg -version');
    console.log('✅ FFmpeg is installed and ready');
  } catch (error) {
    console.error('❌ FFmpeg not found:', error.message);
  }

  // Check yt-dlp
  console.log('\nChecking yt-dlp binary...');
  console.log('Expected path:', YTDLP_BINARY);
  
  if (fs.existsSync(YTDLP_BINARY)) {
    try {
      const stats = fs.statSync(YTDLP_BINARY);
      const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
      
      if (isExecutable) {
        const { stdout } = await execPromise(`${YTDLP_BINARY} --version`);
        console.log('✅ yt-dlp is installed and ready');
        console.log('   Version:', stdout.trim());
        console.log('   Path:', YTDLP_BINARY);
      } else {
        console.log('⚠️  yt-dlp found but not executable');
        console.log('   Attempting to fix permissions...');
        await execPromise(`chmod +x ${YTDLP_BINARY}`);
        console.log('✅ Permissions fixed');
      }
    } catch (error) {
      console.error('❌ Error checking yt-dlp:', error.message);
    }
  } else {
    console.log('⚠️  WARNING: yt-dlp not found at:', YTDLP_BINARY);
    console.log('   Checking alternative locations...');
    
    // Check if yt-dlp is in PATH
    try {
      const { stdout } = await execPromise('which yt-dlp');
      console.log('   Found in PATH:', stdout.trim());
    } catch {
      console.log('   Not found in PATH');
    }
  }

  console.log('\n🎯 Server ready!\n');
}

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  await checkDependencies();
});