'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Lock, Delete, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = useCallback(
    async (codeToSubmit: string) => {
      if (loading) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: codeToSubmit }),
        });

        const data = await res.json();
        if (data.success) {
          router.replace('/');
          router.refresh();
        } else {
          setError(data.error || 'Incorrect PIN');
          setIsShaking(true);
          setTimeout(() => {
            setIsShaking(false);
            setPin('');
          }, 600);
        }
      } catch (err: any) {
        setError('Network error. Please try again.');
        setPin('');
      } finally {
        setLoading(false);
      }
    },
    [loading, router]
  );

  const handleKeyPress = (num: string) => {
    if (loading || pin.length >= 4) return;
    const nextPin = pin + num;
    setPin(nextPin);
    setError(null);

    // Auto-submit on 4th digit
    if (nextPin.length === 4) {
      handleSubmit(nextPin);
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  // Support physical keyboard on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Enter' && pin.length === 4) {
        handleSubmit(pin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, handleKeyPress, pin]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-between p-6 select-none max-w-md mx-auto">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mt-12">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30 mb-4 animate-in zoom-in-95 duration-300">
          <Play className="w-8 h-8 fill-white text-white translate-x-0.5" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">StreamPulse</h1>
        <p className="text-xs text-neutral-400 mt-1 flex items-center space-x-1">
          <Lock className="w-3 h-3 inline text-neutral-500" />
          <span>Private Family Streaming</span>
        </p>
      </div>

      {/* PIN Indicator & Prompt */}
      <div className="flex flex-col items-center my-8 w-full">
        <p className="text-sm font-medium text-neutral-300 mb-6">
          Enter 4-Digit Access PIN
        </p>

        {/* 4 PIN Dots */}
        <div
          className={`flex items-center space-x-5 transition-transform ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-primary scale-125 shadow-md shadow-primary/50'
                    : 'bg-neutral-800 border border-neutral-700'
                }`}
              />
            );
          })}
        </div>

        {/* Feedback message */}
        <div className="h-6 mt-4">
          {loading ? (
            <div className="flex items-center space-x-2 text-xs text-neutral-400">
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Verifying...</span>
            </div>
          ) : error ? (
            <p className="text-xs text-red-500 font-semibold animate-in fade-in">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* Touch Numeric Keypad */}
      <div className="w-full max-w-[320px] mb-8">
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="aspect-square flex items-center justify-center rounded-2xl bg-neutral-900/90 border border-neutral-800 text-xl font-semibold text-white hover:bg-neutral-800 active:scale-90 active:bg-neutral-750 transition-all duration-150 shadow-sm"
            >
              {digit}
            </button>
          ))}

          {/* Empty spacer */}
          <div className="aspect-square" />

          {/* 0 button */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="aspect-square flex items-center justify-center rounded-2xl bg-neutral-900/90 border border-neutral-800 text-xl font-semibold text-white hover:bg-neutral-800 active:scale-90 active:bg-neutral-750 transition-all duration-150 shadow-sm"
          >
            0
          </button>

          {/* Backspace button */}
          <button
            type="button"
            onClick={handleDelete}
            className="aspect-square flex items-center justify-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60 text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-90 transition-all duration-150"
            aria-label="Delete"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-[11px] text-neutral-600 text-center pb-4">
        Default Family PIN is set to <span className="font-mono text-neutral-500">1234</span>
      </div>
    </div>
  );
}
