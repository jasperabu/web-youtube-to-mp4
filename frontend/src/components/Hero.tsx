import { RefreshCw, Video, Music, FileText, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// 🔥 API URL Configuration
const API_URL = process.env.REACT_APP_API_URL || 'https://web-youtube-to-mp4.onrender.com';

type FormatType = 'mp4' | 'mp3' | 'subtitle';

type Resolution = {
  quality: number;
  ext: string;
  filesize: number | null;
  format_id: string;
};

type AudioFormat = {
  ext: string;
  filesize: number | null;
  format_id: string;
  abr: number | null;
};

type Subtitle = {
  language: string;
  ext: string;
  url: string;
};

function extractVideoId(url: string): string | null {
  const regex =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]{11}).*/;
  const match = url.match(regex);
  return match ? match[2] : null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'N/A';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function Hero(): JSX.Element {
  const [url, setUrl] = useState<string>('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [audioFormats, setAudioFormats] = useState<AudioFormat[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<FormatType>('mp4');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingItem, setDownloadingItem] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Check backend connection on mount
  useEffect(() => {
    console.log('🌐 API URL:', API_URL);
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(data => {
        console.log('✅ Backend connected:', data);
      })
      .catch(err => {
        console.error('❌ Backend connection failed:', err);
        setError('Unable to connect to backend server. Please try again later.');
      });
  }, []);

  const formats: { type: FormatType; label: string; icon: JSX.Element }[] = [
    { type: 'mp4', label: 'VIDEO', icon: <Video size={16} /> },
    { type: 'mp3', label: 'AUDIO', icon: <Music size={16} /> },
    { type: 'subtitle', label: 'SUBS', icon: <FileText size={16} /> },
  ];

  const handleShowThumbnail = async () => {
    const id = extractVideoId(url);
    if (!id) {
      setError('Invalid YouTube URL. Please enter a valid YouTube video URL.');
      return;
    }

    setError(null);
    setVideoId(id);
    setVideoTitle(null);
    setVideoDuration(null);
    setResolutions([]);
    setAudioFormats([]);
    setSubtitles([]);
    setIsFetching(true);

    try {
      console.log('🔍 Fetching video info from:', `${API_URL}/api/formats`);
      
      const res = await fetch(
        `${API_URL}/api/formats?url=${encodeURIComponent(url)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.details || errorData.error || `Server returned ${res.status}`);
      }
      
      const data = await res.json();

      setVideoTitle(data.title);
      setVideoDuration(data.duration);
      setResolutions(data.formats || []);
      setAudioFormats(data.audio || []);
      
      // Process subtitles
      if (data.subtitles) {
        const subs: Subtitle[] = [];
        Object.keys(data.subtitles).forEach(lang => {
          const subFormats = data.subtitles[lang];
          if (Array.isArray(subFormats) && subFormats.length > 0) {
            subs.push({
              language: lang,
              ext: subFormats[0].ext || 'vtt',
              url: subFormats[0].url
            });
          }
        });
        setSubtitles(subs);
      }
      
      console.log('✅ Video info fetched successfully');
    } catch (err) {
      console.error('❌ Failed to fetch video info:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('bot detection') || err.message.includes('403')) {
          setError('YouTube is blocking requests. Please wait a moment and try again, or try a different video.');
        } else if (err.message.includes('Failed to fetch')) {
          setError('Cannot connect to server. Please check your internet connection and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsFetching(false);
    }
  };

  const handleDownloadMedia = async (formatId: string, type: 'audio' | 'video'): Promise<void> => {
    const itemKey = `${type}-${formatId}`;
    setDownloadingItem(itemKey);
    setIsDownloading(true);
    setProgress(0);
    setDownloadStatus('Initializing...');
    setError(null);

    // Create abort controller for this download
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams({
        url: url,
        type: type,
        format_id: formatId,
      });
      
      const downloadUrl = `${API_URL}/api/download?${params.toString()}`;
      
      console.log(`🔽 Starting ${type} download:`, downloadUrl);
      setDownloadStatus('Connecting to server...');
      
      const response = await fetch(downloadUrl, {
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.details || errorData.error || `Server returned ${response.status}`);
      }

      // Get total file size from headers
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = type === 'audio' ? 'audio.mp3' : 'video.mp4';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      console.log(`📦 Downloading: ${filename}`);
      console.log(`📊 File size: ${total > 0 ? (total / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
      setDownloadStatus(`Downloading ${filename}...`);

      // Read the response as a stream with progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;
      let lastUpdateTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream completed');
          break;
        }
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Update progress (throttle updates to every 100ms)
        const now = Date.now();
        if (now - lastUpdateTime > 100 || receivedLength === total) {
          if (total > 0) {
            const percentComplete = Math.round((receivedLength / total) * 100);
            setProgress(percentComplete);
            setDownloadStatus(
              `Downloading: ${(receivedLength / 1024 / 1024).toFixed(2)} MB / ${(total / 1024 / 1024).toFixed(2)} MB (${percentComplete}%)`
            );
          } else {
            setProgress(50);
            setDownloadStatus(`Downloading: ${(receivedLength / 1024 / 1024).toFixed(2)} MB...`);
          }
          lastUpdateTime = now;
        }
      }

      console.log(`✅ Download complete: ${(receivedLength / 1024 / 1024).toFixed(2)} MB`);
      setDownloadStatus('Processing file...');
      setProgress(100);

      // Combine chunks into a single Uint8Array
      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      // Create blob from the data
      const blob = new Blob([chunksAll], { 
        type: type === 'audio' ? 'audio/mpeg' : 'video/mp4' 
      });

      console.log(`📦 Created blob: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      // Create download link and trigger download
      setDownloadStatus('Saving file...');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      
      // Clean up blob URL after a short delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        console.log('🗑️ Cleaned up blob URL');
      }, 100);

      console.log('✅ File saved to downloads folder');
      setDownloadStatus('✓ Download complete!');
      
    } catch (err) {
      console.error('❌ Download error:', err);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.log('Download cancelled by user');
          setDownloadStatus('Download cancelled');
        } else {
          const errorMsg = err.message;
          setDownloadStatus(`Error: ${errorMsg}`);
          setError(`Download failed: ${errorMsg}`);
        }
      } else {
        setDownloadStatus('Unknown error occurred');
        setError('Download failed. Please try again.');
      }
    } finally {
      // Reset state after a delay
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadingItem(null);
        setProgress(0);
        setDownloadStatus('');
        abortControllerRef.current = null;
      }, 2000);
    }
  };

  return (
    <div className="pixel-bg min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 mt-12">
          <h1 className="pixel-title mb-4">YOUTUBE → MP4</h1>
          <p className="pixel-subtitle">PASTE · DOWNLOAD · ENJOY</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="pixel-panel bg-red-50 border-red-300 mb-6">
            <div className="flex gap-3 items-start">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-1" />
              <div className="text-xs text-red-800">
                <p className="font-semibold mb-1">Error:</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Download Progress */}
        {isDownloading && (
          <div className="pixel-panel bg-blue-50 border-blue-300 mb-6">
            <div className="flex gap-3 items-start">
              <Loader2 size={20} className="text-blue-600 flex-shrink-0 mt-1 animate-spin" />
              <div className="text-xs text-blue-800 flex-1">
                <p className="font-semibold mb-2">{downloadStatus}</p>
                {progress > 0 && (
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      
        {/* Input + Format Tabs */}
        <div className="pixel-panel mb-8">
          <div className="flex gap-2 mb-6 flex-wrap">
            {formats.map((format) => (
              <button
                key={format.type}
                className={`pixel-tab flex items-center gap-2 ${
                  selectedFormat === format.type ? 'active' : ''
                }`}
                onClick={() => setSelectedFormat(format.type)}
              >
                {format.icon}
                {format.label}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <input
              type="text"
              className="pixel-input"
              placeholder="ENTER YOUTUBE URL..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
            />
          </div>

          <button
            className="pixel-btn large w-full flex items-center justify-center gap-3"
            onClick={handleShowThumbnail}
            disabled={isFetching || !url.trim()}
          >
            <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'LOADING...' : 'GENERATE'}
          </button>
        </div>

        {/* Video Info + Formats Table */}
        {videoId && !isFetching && (
          <div className="pixel-panel grid md:grid-cols-3 gap-6 items-start">
            {/* Left: Thumbnail + Info */}
            <div className="md:col-span-1">
              <img
                className="w-full rounded mb-3"
                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                alt={videoTitle ?? 'YouTube Thumbnail'}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }}
              />
              {videoTitle && (
                <h3 className="text-sm font-semibold mb-1">{videoTitle}</h3>
              )}
              {videoDuration && (
                <p className="text-xs opacity-70">{videoDuration}</p>
              )}
            </div>

            {/* Right: Formats Table */}
            <div className="md:col-span-2 border rounded overflow-hidden">
              {/* VIDEO FORMATS */}
              {selectedFormat === 'mp4' && (
                <>
                  <div className="grid grid-cols-4 items-center p-3 border-t text-xs font-semibold">
                    <div>Format</div>
                    <div>Resolution</div>
                    <div>File Size</div>
                    <div>Download</div>
                  </div>

                  {resolutions.length === 0 ? (
                    <div className="p-3 bg-blue-600 text-white text-xs text-center">
                      No video formats available
                    </div>
                  ) : (
                    resolutions.map((item, i) => {
                      const itemKey = `video-${item.format_id}`;
                      const isDownloadingThis = downloadingItem === itemKey;
                      
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-4 items-center p-3 border-t text-xs"
                        >
                          <div>{item.ext.toUpperCase()}</div>
                          <div>{item.quality}p</div>
                          <div>{formatFileSize(item.filesize)}</div>
                          <button 
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            onClick={() => handleDownloadMedia(item.format_id, 'video')}
                            disabled={isDownloading}
                          >
                            {isDownloadingThis ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <>
                                <Download size={12} />
                                Download
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* AUDIO FORMATS */}
              {selectedFormat === 'mp3' && (
                <>
                  <div className="grid grid-cols-4 items-center p-3 border-t text-xs font-semibold">
                    <div>Format</div>
                    <div>Bitrate</div>
                    <div>File Size</div>
                    <div>Download</div>
                  </div>

                  {audioFormats.length === 0 ? (
                    <div className="p-3 bg-blue-600 text-white text-xs text-center">
                      No audio formats available
                    </div>
                  ) : (
                    audioFormats.map((item, i) => {
                      const itemKey = `audio-${item.format_id}`;
                      const isDownloadingThis = downloadingItem === itemKey;
                      
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-4 items-center p-3 border-t text-xs"
                        >
                          <div>{item.ext.toUpperCase()}</div>
                          <div>{item.abr ? `${Math.round(item.abr)} kbps` : 'N/A'}</div>
                          <div>{formatFileSize(item.filesize)}</div>
                          <button 
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            onClick={() => handleDownloadMedia(item.format_id, 'audio')}
                            disabled={isDownloading}
                          >
                            {isDownloadingThis ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <>
                                <Download size={12} />
                                Download
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* SUBTITLES */}
              {selectedFormat === 'subtitle' && (
                <>
                  <div className="grid grid-cols-3 items-center p-3 border-t text-xs font-semibold">
                    <div>Language</div>
                    <div>Format</div>
                    <div>Download</div>
                  </div>

                  {subtitles.length === 0 ? (
                    <div className="p-3 bg-blue-600 text-white text-xs text-center">
                      No subtitles available
                    </div>
                  ) : subtitles.length > 10 ? (
                    <>
                      <div className="p-3">
                        <select
                          className="pixel-input w-full"
                          value={selectedSubtitleIndex}
                          onChange={(e) => setSelectedSubtitleIndex(parseInt(e.target.value))}
                        >
                          {subtitles.map((sub, idx) => (
                            <option key={idx} value={idx}>
                              {sub.language.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 items-center p-3 border-t text-xs">
                        <div className="uppercase">{subtitles[selectedSubtitleIndex].language}</div>
                        <div>{subtitles[selectedSubtitleIndex].ext.toUpperCase()}</div>
                        <button 
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs"
                          onClick={() => {
                            window.open(subtitles[selectedSubtitleIndex].url, '_blank');
                          }}
                        >
                          Download
                        </button>
                      </div>
                    </>
                  ) : (
                    subtitles.map((item, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-3 items-center p-3 border-t text-xs"
                      >
                        <div className="uppercase">{item.language}</div>
                        <div>{item.ext.toUpperCase()}</div>
                        <button 
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs"
                          onClick={() => {
                            window.open(item.url, '_blank');
                          }}
                        >
                          Download
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* How to Use Section */}
        <div className="pixel-panel mb-8">
          <div className="pixel-panel-inset">
            <h3 className="text-xs mb-4" style={{ color: 'var(--pixel-blue)' }}>
              HOW TO USE
            </h3>
            <ol className="text-xs space-y-3" style={{ color: 'var(--pixel-gray)', lineHeight: '1.8' }}>
              <li>1. COPY VIDEO URL FROM YOUTUBE</li>
              <li>2. PASTE IN BOX ABOVE</li>
              <li>3. SELECT FORMAT (VIDEO/AUDIO/SUBS)</li>
              <li>4. CLICK GENERATE</li>
              <li>5. CHOOSE QUALITY AND DOWNLOAD</li>
              <li>6. KEEP TAB OPEN UNTIL DOWNLOAD COMPLETES</li>
            </ol>
          </div>

          <div className="pixel-panel-inset">
            <h3 className="text-xs mb-4" style={{ color: 'var(--pixel-green)' }}>
              FEATURES
            </h3>
            <ul className="text-xs space-y-3" style={{ color: 'var(--pixel-gray)', lineHeight: '1.8' }}>
              <li>→ HD QUALITY UP TO 4K</li>
              <li>→ REAL-TIME PROGRESS</li>
              <li>→ NO ADS OR POPUPS</li>
              <li>→ 100% FREE FOREVER</li>
              <li>→ FAST DOWNLOADS</li>
            </ul>
          </div>
        </div>

        {/* Important Notice */}
        <div className="pixel-panel bg-yellow-50 border-yellow-300">
          <div className="flex gap-3 items-start">
            <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-1" />
            <div className="text-xs">
              <p className="font-semibold mb-2">Important Tips:</p>
              <ul className="space-y-1 text-gray-700">
                <li>• Keep this tab open during download</li>
                <li>• Large files may take several minutes</li>
                <li>• Check your Downloads folder when complete</li>
                <li>• If you get a bot detection error, wait a minute and try again</li>
                <li>• Try a different video if one doesn't work</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}