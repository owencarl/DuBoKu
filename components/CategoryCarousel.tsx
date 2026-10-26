'use client';

import React from 'react';
import Image from 'next/image';
import { Star, Play } from 'lucide-react';
import { MediaItem } from '@/lib/types';

interface CategoryCarouselProps {
  title: string;
  items: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
}

export default function CategoryCarousel({ title, items, onSelectMedia }: CategoryCarouselProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
      </div>

      {/* Horizontal smooth touch scrolling container */}
      <div className="flex overflow-x-auto gap-3 px-4 pb-2 scrollbar-none snap-x snap-mandatory">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectMedia(item)}
            className="flex-none w-[130px] md:w-[160px] snap-start group cursor-pointer"
          >
            <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-md transition-transform duration-200 active:scale-95 group-hover:border-neutral-700">
              <Image
                src={item.poster}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 130px, 160px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />

              {/* Status Badge */}
              {item.status && (
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-[10px] font-semibold text-neutral-200 px-1.5 py-0.5 rounded shadow-sm">
                  {item.status}
                </div>
              )}

              {/* Rating Badge */}
              {item.rating && (
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-xs text-[10px] font-bold text-amber-400 px-1.5 py-0.5 rounded flex items-center space-x-0.5 shadow-sm">
                  <Star className="w-2.5 h-2.5 fill-amber-400 inline" />
                  <span>{item.rating}</span>
                </div>
              )}

              {/* Play Hover Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="p-2.5 rounded-full bg-primary text-white shadow-lg">
                  <Play className="w-5 h-5 fill-white translate-x-0.5" />
                </div>
              </div>
            </div>

            <div className="mt-2">
              <h3 className="text-xs font-semibold text-neutral-200 line-clamp-1 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                {item.year || item.category || 'Featured'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
