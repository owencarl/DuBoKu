'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Play, Trash2, Clock } from 'lucide-react';
import { WatchHistoryItem } from '@/lib/types';
import { getWatchHistory } from '@/lib/storage';

interface WatchHistoryViewProps {
  onResume: (mediaId: string, episodeId: string) => void;
}

export default function WatchHistoryView({ onResume }: WatchHistoryViewProps) {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  useEffect(() => {
    setHistory(getWatchHistory());
  }, []);

  const handleClear = () => {
    if (confirm('Clear all watch history?')) {
      localStorage.removeItem('streampulse_watch_history');
      setHistory([]);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="p-4 rounded-full bg-neutral-900 border border-neutral-800 mb-3 text-neutral-500">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-neutral-300">No Watch History Yet</h3>
        <p className="text-xs text-neutral-500 mt-1 max-w-xs">
          Shows and movies you watch will automatically remember your place here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Continue Watching</h2>
        <button
          onClick={handleClear}
          className="flex items-center space-x-1 text-xs text-neutral-400 hover:text-red-400 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="space-y-3">
        {history.map((item) => {
          const progressPercent = Math.min(
            100,
            Math.round((item.currentTime / (item.duration || 1)) * 100)
          );

          return (
            <div
              key={`${item.mediaId}-${item.episodeId}`}
              onClick={() => onResume(item.mediaId, item.episodeId)}
              className="flex items-center space-x-3 p-2.5 rounded-xl bg-neutral-900 border border-neutral-850 hover:border-neutral-750 transition active:scale-[0.98] cursor-pointer group"
            >
              {/* Thumbnail / Poster */}
              <div className="relative w-20 h-28 shrink-0 rounded-lg overflow-hidden bg-neutral-950">
                <Image
                  src={item.poster}
                  alt={item.mediaTitle}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="p-1.5 rounded-full bg-primary/90 text-white">
                    <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
                  </div>
                </div>

                {/* Progress bar overlay on image */}
                <div className="absolute bottom-0 inset-x-0 h-1 bg-neutral-800">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
                  {item.mediaTitle}
                </h4>
                <p className="text-xs text-neutral-400 mt-1 truncate">
                  Episode {item.episodeNumber}: {item.episodeTitle || `Ep ${item.episodeNumber}`}
                </p>

                <div className="flex items-center space-x-2 mt-2 text-[11px] text-neutral-500 font-mono">
                  <span>{formatTime(item.currentTime)}</span>
                  <span>/</span>
                  <span>{formatTime(item.duration)}</span>
                  <span className="text-primary font-sans font-medium ml-1">
                    ({progressPercent}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
