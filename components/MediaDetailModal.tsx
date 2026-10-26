'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Play, Bookmark, BookmarkCheck, Star, Calendar, User, Film, AlertCircle } from 'lucide-react';
import { MediaDetail, Episode } from '@/lib/types';
import { getWatchHistory, isFavorite, toggleFavorite } from '@/lib/storage';

interface MediaDetailModalProps {
  mediaId: string;
  onClose: () => void;
  onPlayEpisode: (media: MediaDetail, episode: Episode) => void;
}

export default function MediaDetailModal({
  mediaId,
  onClose,
  onPlayEpisode,
}: MediaDetailModalProps) {
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [lastWatchedEpId, setLastWatchedEpId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/media/${mediaId}`);
        const json = await res.json();
        if (active) {
          if (json.success && json.data) {
            setMedia(json.data);
            setBookmarked(isFavorite(json.data.id));

            // Check if there is watch history for this media
            const history = getWatchHistory();
            const lastWatched = history.find((h) => h.mediaId === json.data.id);
            if (lastWatched) {
              setLastWatchedEpId(lastWatched.episodeId);
            }
          } else {
            setError(json.error || 'Failed to fetch details for this title.');
          }
        }
      } catch (e: any) {
        console.error('Failed to load media detail', e);
        if (active) setError(e.message || 'Network error loading title details.');
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchDetail();

    return () => {
      active = false;
    };
  }, [mediaId]);

  const handleToggleBookmark = () => {
    if (!media) return;
    const newState = toggleFavorite(media.id);
    setBookmarked(newState);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Could Not Load Details</h3>
          <p className="text-xs text-neutral-400 mb-5 leading-relaxed">{error}</p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-750 text-white text-xs font-semibold transition active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!media) return null;

  // Determine starting episode (either resume or episode 1)
  const defaultEp =
    media.episodes.find((ep) => ep.id === lastWatchedEpId) || media.episodes[0];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative shadow-2xl pb-8"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Backdrop */}
        <div className="relative aspect-video w-full bg-neutral-950">
          <Image
            src={media.backdrop || media.poster}
            alt={media.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />

          {/* Quick Play Float Button */}
          {defaultEp && (
            <button
              onClick={() => onPlayEpisode(media, defaultEp)}
              className="absolute bottom-4 left-4 flex items-center space-x-2 bg-primary hover:bg-primary-hover active:scale-95 text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-primary/30 transition"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{lastWatchedEpId ? 'Resume Playing' : 'Play Now'}</span>
            </button>
          )}

          <button
            onClick={handleToggleBookmark}
            className="absolute bottom-4 right-4 p-2.5 rounded-full bg-neutral-800/80 hover:bg-neutral-800 text-white backdrop-blur-xs active:scale-95 transition"
            title="Bookmark"
          >
            {bookmarked ? (
              <BookmarkCheck className="w-5 h-5 text-primary" />
            ) : (
              <Bookmark className="w-5 h-5 text-neutral-300" />
            )}
          </button>
        </div>

        {/* Content Info */}
        <div className="px-5 pt-3">
          <h2 className="text-xl font-bold text-white leading-tight">{media.title}</h2>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-neutral-400">
            {media.rating && (
              <span className="flex items-center space-x-1 text-amber-400 font-semibold bg-amber-400/10 px-2 py-0.5 rounded">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>{media.rating}</span>
              </span>
            )}
            {media.year && (
              <span className="flex items-center space-x-1 bg-neutral-800 px-2 py-0.5 rounded">
                <Calendar className="w-3 h-3" />
                <span>{media.year}</span>
              </span>
            )}
            {media.category && (
              <span className="bg-neutral-800 px-2 py-0.5 rounded">
                {media.category}
              </span>
            )}
            {media.status && (
              <span className="bg-primary/20 text-primary font-medium px-2 py-0.5 rounded">
                {media.status}
              </span>
            )}
          </div>

          {/* Synopsis */}
          {media.description && (
            <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
              {media.description}
            </p>
          )}

          {/* Tags */}
          {media.tags && media.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {media.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] bg-neutral-800/80 text-neutral-400 px-2 py-0.5 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Cast / Director */}
          {(media.actors || media.director) && (
            <div className="mt-4 pt-3 border-t border-neutral-800/60 text-xs text-neutral-400 space-y-1">
              {media.director && (
                <div className="flex items-center space-x-1">
                  <Film className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                  <span>
                    <strong className="text-neutral-300">Director:</strong> {media.director}
                  </span>
                </div>
              )}
              {media.actors && (
                <div className="flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                  <span className="line-clamp-1">
                    <strong className="text-neutral-300">Cast:</strong> {media.actors.join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Episode Grid */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Episodes ({media.episodes.length})
              </h3>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {media.episodes.map((ep) => {
                const isSelected = ep.id === lastWatchedEpId;
                return (
                  <button
                    key={ep.id}
                    onClick={() => onPlayEpisode(media, ep)}
                    className={`py-2.5 px-1 rounded-xl text-center flex flex-col items-center justify-center transition active:scale-95 border ${
                      isSelected
                        ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                        : 'bg-neutral-800/60 border-neutral-750 text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-xs font-semibold">Ep {ep.number}</span>
                    {ep.duration && (
                      <span className="text-[10px] text-neutral-500 mt-0.5">{ep.duration}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
