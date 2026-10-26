'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Tv,
  ArrowLeft,
  Volume2,
  VolumeX,
  SkipForward,
  SkipBack,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';
import { MediaDetail, Episode } from '@/lib/types';
import { getResumeTime, saveWatchProgress } from '@/lib/storage';

interface PlayerProps {
  media: MediaDetail;
  currentEpisode: Episode;
  onClose: () => void;
  onSelectEpisode: (episode: Episode) => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
}

export default function Player({
  media,
  currentEpisode,
  onClose,
  onSelectEpisode,
  onNextEpisode,
  onPrevEpisode,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showEpisodeSheet, setShowEpisodeSheet] = useState(false);

  // Double tap feedback
  const [tapFeedback, setTapFeedback] = useState<{ side: 'left' | 'right'; show: boolean }>({
    side: 'left',
    show: false,
  });

  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // Resolve raw stream URL or proxied URL
  const fetchStreamUrl = useCallback(async (episodeId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/media/stream/${episodeId}`);
      const json = await res.json();
      if (!json.success || !json.data?.streamUrl) {
        throw new Error(json.error || 'Failed to resolve stream URL from server.');
      }

      return {
        streamUrl: json.data.streamUrl as string,
        fallbackProxyUrl: (json.data.fallbackProxyUrl as string) || `/api/proxy?url=${encodeURIComponent(json.data.streamUrl)}`,
      };
    } catch (err: any) {
      console.error('[Player] Stream load error:', err);
      setErrorMessage(err.message || 'Unable to play this stream.');
      setIsLoading(false);
      return null;
    }
  }, []);

  // Initialize Video & HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;

    async function setupHls() {
      const currentVideo = videoRef.current;
      if (!currentVideo) return;

      const streamData = await fetchStreamUrl(currentEpisode.id);
      if (destroyed || !streamData || !videoRef.current) return;

      const targetVideo = videoRef.current;
      let usingFallback = false;

      // Clean up existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const resumeTime = getResumeTime(media.id, currentEpisode.id);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          xhrSetup: (xhr) => {
            xhr.withCredentials = true;
          },
        });

        // Function to switch to fallback proxy URL seamlessly without user intervention
        const tryFallbackProxy = () => {
          if (!usingFallback && streamData.fallbackProxyUrl) {
            console.log('[Player] Direct stream failed; switching seamlessly to fallback proxy:', streamData.fallbackProxyUrl);
            usingFallback = true;
            hls.loadSource(streamData.fallbackProxyUrl);
            hls.startLoad();
            return true;
          }
          return false;
        };

        // Try direct streamUrl first (zero serverless bandwidth)
        hls.loadSource(streamData.streamUrl);
        hls.attachMedia(targetVideo);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setErrorMessage(null);
          if (resumeTime > 5) {
            targetVideo.currentTime = resumeTime;
          }
          targetVideo.play().catch(() => setIsPlaying(false));
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          // Check for CORS / 403 / load errors on direct stream
          const isLoadError =
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.KEY_LOAD_ERROR ||
            data.response?.code === 403 ||
            data.response?.code === 0;

          if (!usingFallback && isLoadError && streamData.fallbackProxyUrl) {
            if (tryFallbackProxy()) return;
          }

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (!usingFallback && streamData.fallbackProxyUrl) {
                  if (tryFallbackProxy()) break;
                }
                console.warn('[Player] HLS network error, attempting reload...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('[Player] HLS media error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                if (!usingFallback && streamData.fallbackProxyUrl) {
                  if (tryFallbackProxy()) break;
                }
                hls.destroy();
                setErrorMessage('Unable to play video stream. The media source may be offline.');
                setIsLoading(false);
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (targetVideo.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS for Safari/iOS
        targetVideo.src = streamData.streamUrl;
        targetVideo.addEventListener(
          'loadedmetadata',
          () => {
            setIsLoading(false);
            if (resumeTime > 5) {
              targetVideo.currentTime = resumeTime;
            }
            targetVideo.play().catch(() => setIsPlaying(false));
          },
          { once: true }
        );
        targetVideo.addEventListener(
          'error',
          () => {
            if (!usingFallback && streamData.fallbackProxyUrl) {
              console.log('[Player Native] Direct load failed, trying fallback proxy...');
              usingFallback = true;
              targetVideo.src = streamData.fallbackProxyUrl;
              targetVideo.load();
              targetVideo.play().catch(() => {});
            } else {
              setErrorMessage('Native video playback failed.');
              setIsLoading(false);
            }
          },
          { once: true }
        );
      }
    }

    setupHls();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentEpisode.id, fetchStreamUrl, media.id]);

  // MediaSession API setup for Android lock screen & notification controls
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${currentEpisode.title || `Episode ${currentEpisode.number}`}`,
      artist: media.title,
      album: 'StreamPulse',
      artwork: [
        {
          src: media.poster,
          sizes: '512x512',
          type: 'image/jpeg',
        },
        {
          src: media.backdrop || media.poster,
          sizes: '1280x720',
          type: 'image/jpeg',
        },
      ],
    });

    const video = videoRef.current;
    if (!video) return;

    navigator.mediaSession.setActionHandler('play', () => {
      video.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      video.pause();
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skip = details.seekOffset || 10;
      video.currentTime = Math.max(video.currentTime - skip, 0);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skip = details.seekOffset || 10;
      video.currentTime = Math.min(video.currentTime + skip, video.duration);
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        video.currentTime = details.seekTime;
      }
    });

    if (onPrevEpisode) {
      navigator.mediaSession.setActionHandler('previoustrack', onPrevEpisode);
    }
    if (onNextEpisode) {
      navigator.mediaSession.setActionHandler('nexttrack', onNextEpisode);
    }

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [currentEpisode, media, onNextEpisode, onPrevEpisode]);

  // Sync playback position & update watch progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    // Update buffer progress
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }

    // Save watch progress to localStorage throttled (every 4 seconds)
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 4000 && video.duration > 0) {
      lastSaveTimeRef.current = now;
      saveWatchProgress({
        mediaId: media.id,
        mediaTitle: media.title,
        poster: media.poster,
        episodeId: currentEpisode.id,
        episodeNumber: currentEpisode.number,
        episodeTitle: currentEpisode.title,
        currentTime: video.currentTime,
        duration: video.duration,
      });
    }
  };

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3500);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
    resetControlsTimer();
  };

  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration));
    resetControlsTimer();
  };

  // Double-tap skip gesture
  const handleTouchScreen = (e: React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const touch = e.touches[0] || e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const isLeft = touchX < rect.width / 2;

    const timeSinceLastTap = now - lastTapRef.current.time;
    const distSinceLastTap = Math.abs(touchX - lastTapRef.current.x);

    if (timeSinceLastTap < 300 && distSinceLastTap < 100) {
      // Trigger double tap
      if (isLeft) {
        seekRelative(-10);
        setTapFeedback({ side: 'left', show: true });
      } else {
        seekRelative(10);
        setTapFeedback({ side: 'right', show: true });
      }

      setTimeout(() => {
        setTapFeedback((prev) => ({ ...prev, show: false }));
      }, 700);

      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: touchX };
      resetControlsTimer();
    }
  };

  // Listen to fullscreenchange to keep state synced & unlock orientation when leaving
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isNowFs);
      if (!isNowFs) {
        try {
          if (screen.orientation && 'unlock' in screen.orientation) {
            (screen.orientation as any).unlock();
          }
        } catch {
          // Ignore orientation unlock error
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      try {
        if (screen.orientation && 'unlock' in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      } catch {}
    };
  }, []);

  // Safe close handler that restores orientation & exits fullscreen
  const handleClose = async () => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch {}
    }
    try {
      if (screen.orientation && 'unlock' in screen.orientation) {
        (screen.orientation as any).unlock();
      }
    } catch {}
    onClose();
  };

  // Picture in Picture
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed', err);
    }
  };

  // Fullscreen with automatic mobile landscape lock
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    try {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );

      if (!isCurrentlyFs) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if (video && (video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        }
        setIsFullscreen(true);

        // Lock to landscape for mobile devices
        if (screen.orientation && 'lock' in screen.orientation) {
          await (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
        if (screen.orientation && 'unlock' in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      }
    } catch (err) {
      console.warn('[Player] Fullscreen/orientation toggle failed:', err);
    }
  };

  // Playback Rate
  const changeSpeed = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none overflow-hidden"
      onTouchStart={handleTouchScreen}
      onClick={resetControlsTimer}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          if (onNextEpisode) onNextEpisode();
        }}
      />

      {/* Double Tap Visual Indicator Animation */}
      {tapFeedback.show && (
        <div
          className={`absolute inset-y-0 ${
            tapFeedback.side === 'left' ? 'left-0' : 'right-0'
          } w-1/3 flex items-center justify-center pointer-events-none bg-white/10 backdrop-blur-xs transition-opacity duration-300`}
        >
          <div className="flex flex-col items-center animate-pulse text-white">
            {tapFeedback.side === 'left' ? (
              <>
                <RotateCcw className="w-12 h-12 mb-1" />
                <span className="text-sm font-semibold">-10s</span>
              </>
            ) : (
              <>
                <RotateCw className="w-12 h-12 mb-1" />
                <span className="text-sm font-semibold">+10s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && !errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Stream Error Overlay */}
      {errorMessage && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200"
        >
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-lg shadow-red-500/10">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1.5">Stream Unavailable</h3>
          <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
            {errorMessage}
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setErrorMessage(null);
                setIsLoading(true);
                fetchStreamUrl(currentEpisode.id);
              }}
              className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-bold transition shadow-md shadow-primary/20"
            >
              Retry Stream
            </button>
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 text-xs font-semibold transition"
            >
              Back to Catalog
            </button>
          </div>
        </div>
      )}

      {/* Top Bar Controls */}
      <div
        className={`absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center space-x-3 max-w-[70%]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="p-2 -ml-2 rounded-full hover:bg-white/20 active:scale-95 transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="truncate">
            <h2 className="text-sm md:text-base font-semibold truncate leading-tight">
              {media.title}
            </h2>
            <p className="text-xs text-neutral-400 truncate">
              {currentEpisode.title || `Episode ${currentEpisode.number}`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* PiP Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePiP();
            }}
            className="p-2 rounded-full hover:bg-white/20 active:scale-95 transition"
            title="Picture in Picture"
          >
            <Tv className="w-5 h-5 text-neutral-200" />
          </button>

          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeedMenu(!showSpeedMenu);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white/10 hover:bg-white/20 border border-white/10 active:scale-95 transition"
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-9 bg-neutral-900 border border-neutral-750 rounded-lg shadow-xl py-1 w-24 z-50"
              >
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changeSpeed(rate)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-neutral-800 flex items-center justify-between ${
                      playbackRate === rate ? 'text-primary font-bold' : 'text-neutral-300'
                    }`}
                  >
                    <span>{rate}x</span>
                    {playbackRate === rate && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Episode Drawer Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEpisodeSheet(true);
            }}
            className="p-2 rounded-full hover:bg-white/20 active:scale-95 transition"
            title="Episodes"
          >
            <SlidersHorizontal className="w-5 h-5 text-neutral-200" />
          </button>
        </div>
      </div>

      {/* Center Controls (Skip / Play / Pause) */}
      <div
        className={`absolute inset-0 flex items-center justify-center space-x-8 pointer-events-none transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            seekRelative(-10);
          }}
          className="pointer-events-auto p-3 rounded-full bg-black/40 hover:bg-white/20 active:scale-90 transition backdrop-blur-xs"
          aria-label="Skip backward 10s"
        >
          <RotateCcw className="w-7 h-7" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="pointer-events-auto p-4 rounded-full bg-primary hover:bg-primary-hover active:scale-90 transition shadow-lg shadow-primary/30"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-9 h-9 fill-white" /> : <Play className="w-9 h-9 fill-white translate-x-0.5" />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            seekRelative(10);
          }}
          className="pointer-events-auto p-3 rounded-full bg-black/40 hover:bg-white/20 active:scale-90 transition backdrop-blur-xs"
          aria-label="Skip forward 10s"
        >
          <RotateCw className="w-7 h-7" />
        </button>
      </div>

      {/* Bottom Controls & Progress Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-6 pt-8 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Scrubber Progress Bar */}
        <div className="flex items-center space-x-3 mb-2">
          <span className="text-xs font-mono text-neutral-300 min-w-[44px]">
            {formatTime(currentTime)}
          </span>

          <div className="relative flex-1 flex items-center h-6 cursor-pointer group">
            {/* Background track */}
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-neutral-700 overflow-hidden">
              {/* Buffer track */}
              <div
                className="h-full bg-neutral-500"
                style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
              />
            </div>
            {/* Play progress track */}
            <div
              className="absolute left-0 h-1.5 rounded-full bg-primary pointer-events-none"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
            {/* Scrubber thumb */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCurrentTime(val);
                if (videoRef.current) {
                  videoRef.current.currentTime = val;
                }
              }}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>

          <span className="text-xs font-mono text-neutral-400 min-w-[44px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Mute/Volume */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-neutral-300" /> : <Volume2 className="w-5 h-5 text-neutral-300" />}
            </button>

            {/* Prev / Next Episode Buttons */}
            {onPrevEpisode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrevEpisode();
                }}
                className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition"
                title="Previous Episode"
              >
                <SkipBack className="w-5 h-5 text-neutral-300" />
              </button>
            )}

            {onNextEpisode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNextEpisode();
                }}
                className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition"
                title="Next Episode"
              >
                <SkipForward className="w-5 h-5 text-neutral-300" />
              </button>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Episode Selection Drawer Modal */}
      {showEpisodeSheet && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowEpisodeSheet(false);
          }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col justify-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-t border-neutral-800 rounded-t-2xl p-5 max-h-[60vh] sm:max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-200"
            style={{
              paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
              paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
              paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white">Episodes ({media.episodes.length})</h3>
              <button
                onClick={() => setShowEpisodeSheet(false)}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1"
              >
                Done
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-neutral-800/60 mt-2">
              {media.episodes.map((ep) => {
                const isActive = ep.id === currentEpisode.id;
                return (
                  <button
                    key={ep.id}
                    onClick={() => {
                      onSelectEpisode(ep);
                      setShowEpisodeSheet(false);
                    }}
                    className={`w-full py-3 px-2 flex items-center justify-between text-left transition rounded-md ${
                      isActive ? 'bg-primary/20 text-primary font-bold' : 'hover:bg-neutral-800/50 text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono ${isActive ? 'bg-primary text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                        {ep.number}
                      </span>
                      <span className="text-sm truncate">{ep.title || `Episode ${ep.number}`}</span>
                    </div>
                    {ep.duration && (
                      <span className="text-xs text-neutral-500 font-mono ml-2 shrink-0">
                        {ep.duration}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
