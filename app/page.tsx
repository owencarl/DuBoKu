'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Search, Play, Info, Sparkles, X, Layers, Globe } from 'lucide-react';
import BottomNav, { NavTab } from '@/components/BottomNav';
import CategoryCarousel from '@/components/CategoryCarousel';
import MediaDetailModal from '@/components/MediaDetailModal';
import WatchHistoryView from '@/components/WatchHistoryView';
import Player from '@/components/Player';
import { MediaCategory, MediaDetail, MediaItem, Episode, MediaSourceInfo } from '@/lib/types';
import { getWatchHistory } from '@/lib/storage';

export default function HomePage() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-Source State
  const [sources, setSources] = useState<MediaSourceInfo[]>([]);
  const [activeSource, setActiveSource] = useState<string>('dbku');
  const [searchSource, setSearchSource] = useState<string>('all');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

  // Modal / Detail state
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);

  // Player state
  const [playingMedia, setPlayingMedia] = useState<MediaDetail | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | null>(null);

  // Load available sources on mount & restore user's preferred source
  useEffect(() => {
    async function initSources() {
      try {
        const res = await fetch('/api/sources');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSources(json.data);
        }
      } catch (err) {
        console.error('Failed to load sources', err);
      }
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('streampulse_source');
      if (saved) {
        setActiveSource(saved);
      }
    }
    initSources();
  }, []);

  // Fetch featured categories for active source
  const loadFeatured = useCallback(async (sourceKey: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/featured?source=${encodeURIComponent(sourceKey)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCategories(json.data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatured(activeSource);
  }, [activeSource, loadFeatured]);

  const handleSourceChange = (sourceKey: string) => {
    if (sourceKey === activeSource) return;
    setActiveSource(sourceKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('streampulse_source', sourceKey);
    }
  };

  // Debounced search with multi-source aggregated support
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const sourceParam = searchSource ? `&source=${encodeURIComponent(searchSource)}` : '';
        const res = await fetch(`/api/media/search?q=${encodeURIComponent(searchQuery.trim())}${sourceParam}`);
        const json = await res.json();
        if (json.success && json.data) {
          setSearchResults(json.data);
        }
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [searchQuery, searchSource]);

  // Handle Play Episode
  const handlePlayEpisode = (media: MediaDetail, episode: Episode) => {
    setSelectedMediaId(null);
    setPlayingMedia(media);
    setPlayingEpisode(episode);
  };

  // Next / Previous episode handlers
  const handleNextEpisode = () => {
    if (!playingMedia || !playingEpisode) return;
    const currentIndex = playingMedia.episodes.findIndex((e) => e.id === playingEpisode.id);
    if (currentIndex >= 0 && currentIndex < playingMedia.episodes.length - 1) {
      setPlayingEpisode(playingMedia.episodes[currentIndex + 1]);
    }
  };

  const handlePrevEpisode = () => {
    if (!playingMedia || !playingEpisode) return;
    const currentIndex = playingMedia.episodes.findIndex((e) => e.id === playingEpisode.id);
    if (currentIndex > 0) {
      setPlayingEpisode(playingMedia.episodes[currentIndex - 1]);
    }
  };

  // Resume from History
  const handleResumeFromHistory = async (mediaId: string, episodeId: string) => {
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const detail: MediaDetail = json.data;
        const episode = detail.episodes.find((e) => e.id === episodeId) || detail.episodes[0];
        setPlayingMedia(detail);
        setPlayingEpisode(episode);
      }
    } catch (e) {
      console.error('Failed to resume item', e);
    }
  };

  // Watch Now from Hero Spotlight
  const handleWatchNow = async (mediaId: string) => {
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const detail: MediaDetail = json.data;
        if (detail.episodes && detail.episodes.length > 0) {
          const history = getWatchHistory();
          const lastWatched = history.find((h) => h.mediaId === detail.id);
          const ep = detail.episodes.find((e) => e.id === lastWatched?.episodeId) || detail.episodes[0];
          setPlayingMedia(detail);
          setPlayingEpisode(ep);
          return;
        }
      }
      setSelectedMediaId(mediaId);
    } catch {
      setSelectedMediaId(mediaId);
    }
  };

  // Spotlit Hero Item from trending
  const heroItem = categories[0]?.items[0];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between selection:bg-primary">
      {/* Top Header / App Bar */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-900/60 px-4 py-3 flex items-center justify-between">
        <div
          onClick={() => setCurrentTab('home')}
          className="flex items-center space-x-2 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Play className="w-4 h-4 fill-white text-white translate-x-0.5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
              StreamPulse
            </h1>
          </div>
        </div>

        <button
          onClick={() => setCurrentTab('search')}
          className="p-2 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 active:scale-95 transition text-neutral-300"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>
      </header>

      {/* Source Selector Bar on Home Screen */}
      {currentTab === 'home' && sources.length > 0 && (
        <div className="bg-neutral-950/80 border-b border-neutral-900/80 px-4 py-2 flex items-center justify-between overflow-x-auto scrollbar-none z-20 sticky top-[57px] backdrop-blur-md">
          <div className="flex items-center space-x-1.5 shrink-0 text-neutral-400 mr-2">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold tracking-wide uppercase">Source</span>
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
            {sources.map((s) => {
              const isActive = activeSource === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => handleSourceChange(s.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 flex items-center space-x-1.5 ${
                    isActive
                      ? 'bg-primary text-white shadow-sm shadow-primary/30 font-bold'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                >
                  <span>{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 pb-20">
        {/* --- TAB 1: HOME --- */}
        {currentTab === 'home' && (
          <div className="animate-in fade-in duration-200">
            {/* Spotlight Hero Banner */}
            {heroItem && (
              <div className="relative aspect-[16/10] md:aspect-[21/9] w-full bg-neutral-950 mb-6 overflow-hidden">
                <Image
                  src={heroItem.backdrop || heroItem.poster}
                  alt={heroItem.title}
                  fill
                  priority
                  className="object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />

                <div className="absolute bottom-4 inset-x-4">
                  <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-primary bg-primary/20 border border-primary/30 px-2 py-0.5 rounded-full mb-1.5 backdrop-blur-xs">
                    <Sparkles className="w-3 h-3" />
                    <span>Editor’s Pick</span>
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow-md">
                    {heroItem.title}
                  </h2>
                  <p className="text-xs text-neutral-300 line-clamp-2 mt-1 max-w-lg drop-shadow">
                    {heroItem.description}
                  </p>

                  <div className="flex items-center space-x-3 mt-3">
                    <button
                      onClick={() => handleWatchNow(heroItem.id)}
                      className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md shadow-primary/30 transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Watch Now</span>
                    </button>
                    <button
                      onClick={() => setSelectedMediaId(heroItem.id)}
                      className="flex items-center space-x-1.5 bg-neutral-800/80 hover:bg-neutral-800 active:scale-95 text-neutral-200 px-3.5 py-2 rounded-full text-xs font-semibold backdrop-blur-xs border border-white/10 transition"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Category Carousels */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              categories.map((cat) => (
                <CategoryCarousel
                  key={cat.id}
                  title={cat.title}
                  items={cat.items}
                  onSelectMedia={(item) => setSelectedMediaId(item.id)}
                />
              ))
            )}
          </div>
        )}

        {/* --- TAB 2: CATEGORIES --- */}
        {currentTab === 'categories' && (
          <div className="px-4 py-3 animate-in fade-in duration-200">
            <h2 className="text-xl font-bold text-white mb-3">Browse by Category</h2>

            {/* Filter Pills */}
            <div className="flex overflow-x-auto gap-2 pb-3 mb-4 scrollbar-none">
              {['All', 'Chinese Drama', 'Korean Drama', 'Movies', 'Anime'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition active:scale-95 ${
                    selectedCategoryFilter === cat
                      ? 'bg-primary text-white font-bold shadow-sm'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Filtered Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {categories
                .flatMap((c) => c.items)
                .filter(
                  (item, idx, self) =>
                    self.findIndex((i) => i.id === item.id) === idx &&
                    (selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter)
                )
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedMediaId(item.id)}
                    className="cursor-pointer group"
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow transition-transform duration-200 active:scale-95 group-hover:border-neutral-700">
                      <Image
                        src={item.poster}
                        alt={item.title}
                        fill
                        sizes="120px"
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                      {item.status && (
                        <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-xs text-[9px] font-semibold text-neutral-200 px-1 py-0.5 rounded">
                          {item.status}
                        </div>
                      )}
                    </div>
                    <h3 className="text-xs font-semibold text-neutral-200 line-clamp-1 mt-1.5 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* --- TAB 3: SEARCH --- */}
        {currentTab === 'search' && (
          <div className="px-4 py-3 animate-in fade-in duration-200">
            {/* Search Input Box */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drama, movie, actor, genre..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary/60 transition"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Multi-Source Aggregated Search Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-2 mb-3">
              <button
                onClick={() => setSearchSource('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 flex items-center space-x-1 ${
                  searchSource === 'all'
                    ? 'bg-primary text-white shadow-sm shadow-primary/30 font-bold'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>全网聚合</span>
              </button>
              {sources.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSearchSource(s.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                    searchSource === s.key
                      ? 'bg-primary text-white shadow-sm shadow-primary/30 font-bold'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* Results or Empty State */}
            {isSearching ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              <div>
                <p className="text-xs text-neutral-400 mb-3">
                  Found {searchResults.length} results
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMediaId(item.id)}
                      className="cursor-pointer group"
                    >
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow active:scale-95 transition-transform">
                        <Image
                          src={item.poster}
                          alt={item.title}
                          fill
                          sizes="130px"
                          className="object-cover"
                        />
                        {item.sourceName && (
                          <div className="absolute top-1.5 right-1.5 bg-black/80 backdrop-blur-xs border border-white/10 text-[9px] font-bold text-primary px-1.5 py-0.5 rounded shadow">
                            {item.sourceName}
                          </div>
                        )}
                        {item.status && (
                          <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-xs text-[9px] font-medium text-neutral-200 px-1 py-0.5 rounded">
                            {item.status}
                          </div>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-neutral-200 line-clamp-1 mt-1.5 group-hover:text-primary">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {item.category || item.year}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : searchQuery.trim() ? (
              <div className="text-center py-16 text-neutral-500 text-sm">
                No matching titles found for &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-500">
                Type keywords like &quot;Hidden Love&quot;, &quot;Queen of Tears&quot;, or &quot;Anime&quot;
              </div>
            )}
          </div>
        )}

        {/* --- TAB 4: HISTORY --- */}
        {currentTab === 'history' && (
          <div className="animate-in fade-in duration-200">
            <WatchHistoryView onResume={handleResumeFromHistory} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Media Detail Modal */}
      {selectedMediaId && (
        <MediaDetailModal
          mediaId={selectedMediaId}
          onClose={() => setSelectedMediaId(null)}
          onPlayEpisode={handlePlayEpisode}
        />
      )}

      {/* Video Streaming Player */}
      {playingMedia && playingEpisode && (
        <Player
          media={playingMedia}
          currentEpisode={playingEpisode}
          onClose={() => {
            setPlayingMedia(null);
            setPlayingEpisode(null);
          }}
          onSelectEpisode={(ep) => setPlayingEpisode(ep)}
          onNextEpisode={handleNextEpisode}
          onPrevEpisode={handlePrevEpisode}
        />
      )}
    </div>
  );
}
