import express from "express";
import cors from "cors";
import ytdlp from "yt-dlp-exec";
import { spawn, exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const execPromise = promisify(exec);

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// CRITICAL: Enhanced CORS configuration for streaming
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type', 'Accept-Ranges'],
  credentials: true,
  maxAge: 86400
}));

// Additional CORS headers middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type, Accept-Ranges');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());

/* 🔹 ROOT CHECK */
app.get("/", (req, res) => {
  res.send("✅ YT Backend is running");
});

/**
 * Check if FFmpeg is available
 */
async function checkFFmpeg() {
  try {
    await execPromise('ffmpeg -version');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Extract clean video ID from YouTube URL
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Clean YouTube URL to remove playlist and extra parameters
 */
function cleanYouTubeUrl(url) {
  const videoId = extractVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url;
}

/* 🔹 FORMATS API */
app.get("/api/formats", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const cleanUrl = cleanYouTubeUrl(url);
  console.log("Original URL:", url);
  console.log("Cleaned URL:", cleanUrl);

  try {
    const info = await ytdlp(cleanUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noPlaylist: true,
      writeAutoSub: true,
      writeSub: true,
      subLangs: "all",
    });

    // Video formats (deduplicated by height)
    const videoFormatsMap = new Map();
    
    info.formats.forEach(f => {
      if (!f.vcodec || f.vcodec === "none") return;
      
      let height = null;
      if (f.resolution) {
        const match = f.resolution.match(/\d+x(\d+)/);
        if (match) {
          height = parseInt(match[1]);
        }
      }
      
      if (!height) return;
      if (f.ext !== "mp4" || !f.filesize) return;
      
      const existing = videoFormatsMap.get(height);
      if (!existing || f.filesize > existing.filesize) {
        videoFormatsMap.set(height, {
          quality: height,
          ext: "mp4",
          filesize: f.filesize,
          format_id: f.format_id,
        });
      }
    });
    
    const videoFormats = Array.from(videoFormatsMap.values())
      .sort((a, b) => b.quality - a.quality);

    // Audio formats
    const audioFormatsMap = new Map();
    
    info.formats.forEach(f => {
      if (f.vcodec && f.vcodec !== "none") return;
      if (!f.acodec || f.acodec === "none") return;
      if (!f.abr) return;
      
      const bitrate = Math.round(f.abr);
      
      const existing = audioFormatsMap.get(bitrate);
      const priority = { m4a: 3, webm: 2, opus: 1 };
      const currentPriority = priority[f.ext] || 0;
      const existingPriority = existing ? (priority[existing.ext] || 0) : 0;
      
      if (!existing || currentPriority > existingPriority) {
        audioFormatsMap.set(bitrate, {
          ext: f.ext,
          filesize: f.filesize ?? null,
          format_id: f.format_id,
          abr: f.abr,
        });
      }
    });
    
    const audioFormats = Array.from(audioFormatsMap.values())
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));

    // Process subtitles
    const subtitles = info.subtitles || {};
    const automaticCaptions = info.automatic_captions || {};
    const allSubtitles = { ...automaticCaptions, ...subtitles };

    res.json({
      title: info.title,
      duration: info.duration_string,
      formats: videoFormats,
      audio: audioFormats,
      subtitles: allSubtitles,
    });
    
  } catch (err) {
    console.error("yt-dlp error:", err);
    res.status(500).json({ error: "Failed to fetch video formats" });
  }
});

/**
 * Sanitize filename for safe download
 */
function safeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 150);
}

/**
 * Create properly encoded Content-Disposition header
 */
function createContentDisposition(filename) {
  const safeName = safeFilename(filename);
  const encodedName = encodeURIComponent(safeName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
  
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`;
}

/**
 * Convert audio file to MP3 using FFmpeg
 */
async function convertToMp3(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Converting to MP3...`);
    console.log(`   Input: ${inputFile}`);
    console.log(`   Output: ${outputFile}`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFile,
      '-vn', // No video
      '-ar', '44100', // Audio sample rate
      '-ac', '2', // Audio channels (stereo)
      '-b:a', '192k', // Audio bitrate
      '-y', // Overwrite output file
      outputFile
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      const timeMatch = stderr.match(/time=(\d+:\d+:\d+\.\d+)/);
      if (timeMatch) {
        console.log(`   Progress: ${timeMatch[1]}`);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Conversion complete`);
        resolve();
      } else {
        console.error(`❌ FFmpeg error (code ${code}):`);
        console.error(stderr);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error(`❌ FFmpeg spawn error:`, err);
      reject(err);
    });
  });
}

/* 🔹 DOWNLOAD API - WITH PROPER CORS FOR STREAMING */
app.get("/api/download", async (req, res) => {
  const { url, format_id, type } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  const cleanUrl = cleanYouTubeUrl(url);
  
  console.log("=== DOWNLOAD REQUEST ===");
  console.log("Original URL:", url);
  console.log("Cleaned URL:", cleanUrl);
  console.log("Format ID:", format_id);
  console.log("Type:", type);

  try {
    const isAudio = type === 'audio';
    
    // Get metadata FIRST for proper filename
    console.log("📋 Fetching video metadata...");
    const info = await ytdlp(cleanUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noPlaylist: true,
    });

    const title = safeFilename(info.title || "download");
    console.log("📝 Video title:", title);
    
    if (isAudio) {
      // ================= AUDIO DOWNLOAD =================
      console.log("🎵 Processing AUDIO download");
      
      const hasFFmpeg = await checkFFmpeg();
      console.log(`🔧 FFmpeg available: ${hasFFmpeg}`);
      
      const filename = `${title}.mp3`;
      console.log("📝 Final filename: ", filename);
      
      const tempDir = os.tmpdir();
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tempAudioFile = path.join(tempDir, `yt-audio-raw-${uniqueId}`);
      const tempMp3File = path.join(tempDir, `yt-audio-${uniqueId}.mp3`);
      
      console.log(`📁 Temp directory: ${tempDir}`);
      console.log(`📁 Raw audio file: ${tempAudioFile}`);
      console.log(`📁 MP3 file: ${tempMp3File}`);

      try {
        // Download audio
        console.log("\n🔧 Downloading audio...");
        
        if (hasFFmpeg) {
          console.log("✅ Using yt-dlp with FFmpeg for direct MP3 conversion");
          await ytdlp(cleanUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0,
            format: format_id || 'bestaudio',
            output: tempMp3File,
            noPlaylist: true,
          });
          
          console.log("✅ Direct MP3 download complete!");
        } else {
          console.log("⚠️  FFmpeg not found, downloading in original format...");
          await ytdlp(cleanUrl, {
            format: format_id || 'bestaudio',
            output: tempAudioFile + '.%(ext)s',
            noPlaylist: true,
          });

          console.log("✅ Download complete!");

          const possibleExtensions = ['.webm', '.m4a', '.opus', '.ogg', '.mp3'];
          let downloadedFile = null;
          
          for (const ext of possibleExtensions) {
            const testPath = tempAudioFile + ext;
            if (fs.existsSync(testPath)) {
              downloadedFile = testPath;
              console.log(`  ✅ Found: ${downloadedFile}`);
              break;
            }
          }

          if (!downloadedFile) {
            throw new Error("Downloaded audio file not found");
          }

          fs.copyFileSync(downloadedFile, tempMp3File);
          console.log("⚠️  Skipped conversion - serving original audio format");
        }

        if (!fs.existsSync(tempMp3File)) {
          throw new Error("Output audio file not found");
        }

        const mp3Stats = fs.statSync(tempMp3File);
        console.log(`📦 Output file size: ${(mp3Stats.size / 1024 / 1024).toFixed(2)} MB`);

        if (mp3Stats.size < 1000) {
          throw new Error("Output file is too small (< 1KB), likely corrupted");
        }

        // Set CORS headers BEFORE streaming
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Content-Type, Accept-Ranges");
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", createContentDisposition(filename));
        res.setHeader("Content-Length", mp3Stats.size);
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Accept-Ranges", "bytes");

        console.log("📤 Streaming to client...");

        const fileStream = fs.createReadStream(tempMp3File);
        
        let streamedBytes = 0;
        let lastLoggedMB = 0;

        fileStream.on('open', () => {
          console.log('📂 File stream opened successfully');
        });

        fileStream.on('data', (chunk) => {
          streamedBytes += chunk.length;
          const currentMB = Math.floor(streamedBytes / (1024 * 1024));
          
          if (currentMB > lastLoggedMB) {
            console.log(`📊 Streamed: ${currentMB} MB / ${(mp3Stats.size / 1024 / 1024).toFixed(2)} MB`);
            lastLoggedMB = currentMB;
          }
        });

        fileStream.on('error', (err) => {
          console.error('❌ File stream error:', err);
          fileStream.destroy();
          
          const possibleFiles = [
            tempAudioFile + '.webm',
            tempAudioFile + '.m4a',
            tempAudioFile + '.opus',
            tempAudioFile + '.ogg',
            tempMp3File
          ];
          
          possibleFiles.forEach(file => {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          });
          
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error', message: err.message });
          }
        });

        fileStream.on('end', () => {
          console.log(`✅ Audio stream completed - ${(streamedBytes / 1024 / 1024).toFixed(2)} MB transferred`);
          
          setTimeout(() => {
            const possibleFiles = [
              tempAudioFile + '.webm',
              tempAudioFile + '.m4a',
              tempAudioFile + '.opus',
              tempAudioFile + '.ogg',
              tempMp3File
            ];
            
            possibleFiles.forEach(file => {
              if (fs.existsSync(file)) {
                fs.unlink(file, (err) => {
                  if (err) console.error('⚠️  Error deleting temp file:', err);
                  else console.log(`🗑️  Deleted: ${path.basename(file)}`);
                });
              }
            });
          }, 1000);
        });

        req.on('close', () => {
          if (!res.writableEnded) {
            console.log('🔌 Client disconnected during streaming');
            fileStream.destroy();
            
            const possibleFiles = [
              tempAudioFile + '.webm',
              tempAudioFile + '.m4a',
              tempAudioFile + '.opus',
              tempAudioFile + '.ogg',
              tempMp3File
            ];
            
            possibleFiles.forEach(file => {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            });
          }
        });

        fileStream.pipe(res);

      } catch (downloadErr) {
        console.error("\n❌ Audio download error:", downloadErr);
        
        const possibleFiles = [
          tempAudioFile + '.webm',
          tempAudioFile + '.m4a',
          tempAudioFile + '.opus',
          tempAudioFile + '.ogg',
          tempMp3File
        ];
        
        possibleFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
        
        if (!res.headersSent) {
          res.status(500).json({ 
            error: "Failed to download audio", 
            message: downloadErr.message,
          });
        }
      }

    } else {
      // ================= VIDEO DOWNLOAD =================
      console.log("🎬 Processing VIDEO download");

      let resolution = "unknown";
      let selectedFormat = null;
      
      if (format_id) {
        selectedFormat = info.formats.find(
          f => String(f.format_id) === String(format_id)
        );
        if (selectedFormat?.height) {
          resolution = `${selectedFormat.height}p`;
        }
      }

      const filename = `${title} (${resolution}).mp4`;
      console.log("📝 Video filename:", filename);

      const tempDir = os.tmpdir();
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tempFile = path.join(tempDir, `yt-video-${uniqueId}.mp4`);
      
      console.log(`📁 Temp file: ${tempFile}`);

      let formatString;
      if (format_id) {
        const hasAudio = selectedFormat?.acodec && selectedFormat.acodec !== "none";
        
        if (hasAudio) {
          formatString = format_id;
          console.log("✅ Format already has audio, no merge needed");
        } else {
          formatString = `${format_id}+bestaudio[ext=m4a]/${format_id}+bestaudio`;
          console.log("🔀 Merging VIDEO format + audio");
        }
      } else {
        formatString = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio/best";
        console.log("🔀 Using best video+audio format");
      }

      try {
        console.log("🔧 Starting video download...");
        
        await ytdlp(cleanUrl, {
          format: formatString,
          mergeOutputFormat: "mp4",
          output: tempFile,
          noPlaylist: true,
          noWarnings: true,
        });

        console.log("✅ Video download complete!");

        if (!fs.existsSync(tempFile)) {
          throw new Error("Downloaded file not found");
        }

        const stats = fs.statSync(tempFile);
        console.log(`📦 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        if (stats.size < 1000) {
          throw new Error("Downloaded file is too small, likely corrupted");
        }

        // Set CORS headers BEFORE streaming
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Content-Type, Accept-Ranges");
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", createContentDisposition(filename));
        res.setHeader("Content-Length", stats.size);
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Accept-Ranges", "bytes");

        console.log("📤 Streaming video to client...");

        const fileStream = fs.createReadStream(tempFile);
        
        let streamedBytes = 0;
        let lastLoggedMB = 0;

        fileStream.on('data', (chunk) => {
          streamedBytes += chunk.length;
          const currentMB = Math.floor(streamedBytes / (1024 * 1024));
          
          if (currentMB > lastLoggedMB) {
            console.log(`📊 Streamed: ${currentMB} MB / ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            lastLoggedMB = currentMB;
          }
        });

        fileStream.on('error', (err) => {
          console.error('❌ File stream error:', err);
          fileStream.destroy();
          fs.unlink(tempFile, () => {});
          
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error' });
          }
        });

        fileStream.on('end', () => {
          console.log(`✅ Video stream completed - ${(streamedBytes / 1024 / 1024).toFixed(2)} MB transferred`);
          
          setTimeout(() => {
            fs.unlink(tempFile, (err) => {
              if (err) console.error('⚠️  Error deleting temp file:', err);
              else console.log('🗑️  Temp file deleted');
            });
          }, 1000);
        });

        req.on('close', () => {
          if (!res.writableEnded) {
            console.log('🔌 Client disconnected during video streaming');
            fileStream.destroy();
            fs.unlink(tempFile, () => {});
          }
        });

        fileStream.pipe(res);

      } catch (downloadErr) {
        console.error("❌ Video download error:", downloadErr);
        
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        if (!res.headersSent) {
          res.status(500).json({ 
            error: "Failed to download video", 
            message: downloadErr.message 
          });
        }
      }
    }

  } catch (err) {
    console.error("❌ General download error:", err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Failed to download", 
        message: err.message 
      });
    }
  }
});

/* 🔹 404 HANDLER */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* 🔹 START SERVER */
app.listen(PORT, async () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for all origins (including streaming)`);
  console.log(`📁 Using temp directory: ${os.tmpdir()}`);
  
  const hasFFmpeg = await checkFFmpeg();
  if (hasFFmpeg) {
    console.log(`✅ FFmpeg is installed and ready`);
  } else {
    console.log(`⚠️  WARNING: FFmpeg not found!`);
    console.log(`⚠️  Audio downloads will use original format instead of MP3`);
  }
  
  console.log('\n🎯 Server ready! Compatible with yt-dlp 1.0.2\n');
});