import { WatchHistoryItem } from './types';

const HISTORY_KEY = 'streampulse_watch_history';
const FAVORITES_KEY = 'streampulse_favorites';

export function getWatchHistory(): WatchHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load history', e);
    return [];
  }
}

export function saveWatchProgress(item: Omit<WatchHistoryItem, 'updatedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const history = getWatchHistory();
    const existingIndex = history.findIndex(
      (h) => h.mediaId === item.mediaId && h.episodeId === item.episodeId
    );

    const updatedItem: WatchHistoryItem = {
      ...item,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    // Put most recently watched at front
    history.unshift(updatedItem);

    // Keep up to 50 entries
    const trimmed = history.slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save watch progress', e);
  }
}

export function getResumeTime(mediaId: string, episodeId: string): number {
  if (typeof window === 'undefined') return 0;
  const history = getWatchHistory();
  const entry = history.find((h) => h.mediaId === mediaId && h.episodeId === episodeId);
  return entry?.currentTime || 0;
}

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(mediaId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const favs = getFavorites();
    const index = favs.indexOf(mediaId);
    let isFav = false;
    if (index >= 0) {
      favs.splice(index, 1);
    } else {
      favs.unshift(mediaId);
      isFav = true;
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return isFav;
  } catch {
    return false;
  }
}

export function isFavorite(mediaId: string): boolean {
  if (typeof window === 'undefined') return false;
  const favs = getFavorites();
  return favs.includes(mediaId);
}
