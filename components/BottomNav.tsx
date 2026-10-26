'use client';

import React from 'react';
import { Home, Compass, Search, Clock } from 'lucide-react';

export type NavTab = 'home' | 'categories' | 'search' | 'history';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export default function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'categories' as NavTab, label: 'Categories', icon: Compass },
    { id: 'search' as NavTab, label: 'Search', icon: Search },
    { id: 'history' as NavTab, label: 'History', icon: Clock },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-neutral-800/80 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 active:scale-90 ${
                isActive ? 'text-primary font-bold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
