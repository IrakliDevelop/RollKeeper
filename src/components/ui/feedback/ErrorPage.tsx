'use client';

import React, { useState, useEffect } from 'react';
import {
  Dice1,
  Dice6,
  RefreshCw,
  Home,
  Skull,
  Shield,
  Wand2,
} from 'lucide-react';

interface ErrorPageProps {
  error?: Error;
  reset?: () => void;
  title?: string;
  description?: string;
  showRetry?: boolean;
  showHome?: boolean;
}

const errorMessages = [
  'You rolled a natural 1 on your website navigation check!',
  "The dungeon master has decreed that this page doesn't exist in this reality.",
  "A wild bug appeared! It used 'Break Everything'. It's super effective!",
  'Your character sheet got eaten by a mimic disguised as a webpage.',
  'The dice gods are not pleased with your internet connection.',
  'A gelatinous cube absorbed this page. Roll for initiative!',
  'This page got turned to stone by a basilisk. Someone cast Greater Restoration!',
  'A dragon breathed fire on the server hosting this page.',
  "The page you're looking for got polymorphed into a sheep.",
  'Critical fumble! Your browser attack missed spectacularly.',
  'The server rolled a 1 on its Constitution saving throw and collapsed.',
  "A Disintegrate spell was cast on this page's code.",
  "The webpage got caught in a Maze spell and can't find its way back.",
  'A Lich drained all the life force from this page.',
  'The page fell into a Bag of Holding and got lost in the Astral Plane.',
  "A Beholder's anti-magic cone nullified this webpage's existence.",
  'The code got cursed by a Warlock patron with trust issues.',
  "This page was sacrificed to summon a greater website (it didn't work).",
  "A Tarrasque stepped on the server. Surprisingly, that wasn't the worst thing to happen today.",
  'The page got stuck in a time loop. Wait, the page got stuck in a time loop. Wait...',
  'A Rust Monster ate all the metal components in the server.',
  'The webpage was banished to the Shadowfell by an angry DM.',
];

const recoveryTips = [
  "Try refreshing the page (it's like casting Revivify)",
  "Check your internet connection (maybe you're in a dead magic zone)",
  'Clear your browser cache (banish those cursed cookies)',
  'Wait a moment and try again (sometimes magic needs time to recharge)',
  'If all else fails, blame the bard',
  'Roll for initiative and try a different approach',
  'Cast Dispel Magic on your browser and try again',
  'Check if you have enough spell slots for this webpage',
  "Make sure you're not in a zone of silence (no internet)",
  'Try turning your device off and on again (technological Lesser Restoration)',
  'Sacrifice a USB cable to the tech gods',
  'Have you tried not rolling a 1 this time?',
  'Maybe this page needs a short rest to recover',
  "Check your browser's spell components (cookies and cache)",
  "Ensure your internet connection isn't being blocked by a Wall of Force",
  'Try using a different browser (multiclassing might help)',
  "Make sure you're not under the effect of a Confusion spell",
];

export default function ErrorPage({
  error,
  reset,
  title = 'Critical Failure!',
  description,
  showRetry = true,
  showHome = true,
}: ErrorPageProps) {
  const [randomMessage, setRandomMessage] = useState('');
  const [randomTip, setRandomTip] = useState('');
  const [isClient, setIsClient] = useState(false);

  // Only set random messages on client side to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
    setRandomMessage(
      errorMessages[Math.floor(Math.random() * errorMessages.length)]
    );
    setRandomTip(recoveryTips[Math.floor(Math.random() * recoveryTips.length)]);
  }, []);

  const handleRetry = () => {
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  const handleHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-red-900 to-black p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-2 w-2 animate-ping rounded-full bg-red-400 opacity-30"></div>
        <div className="absolute top-3/4 right-1/4 h-3 w-3 animate-pulse rounded-full bg-orange-400 opacity-40"></div>
        <div className="absolute top-1/2 left-1/6 h-1 w-1 animate-bounce rounded-full bg-yellow-400 opacity-50"></div>
        <div className="absolute right-1/3 bottom-1/4 h-2 w-2 animate-pulse rounded-full bg-red-300 opacity-30"></div>

        {/* Floating dice */}
        <div className="animate-float absolute top-20 left-20">
          <Dice1 className="h-8 w-8 rotate-12 transform text-red-300 opacity-20" />
        </div>
        <div className="animate-float-delayed absolute top-40 right-32">
          <Dice6 className="h-6 w-6 -rotate-12 transform text-orange-300 opacity-25" />
        </div>
        <div className="animate-float-slow absolute bottom-32 left-40">
          <Wand2 className="h-10 w-10 rotate-45 transform text-purple-300 opacity-15" />
        </div>
      </div>

      {/* Main error content */}
      <div className="relative z-10 w-full max-w-2xl">
        <div className="rounded-xl border border-red-500/30 bg-slate-800/90 p-8 text-center shadow-2xl backdrop-blur-sm">
          {/* Skull icon with glow effect */}
          <div className="relative mb-6">
            <div className="absolute inset-0 animate-pulse rounded-full bg-red-500 opacity-30 blur-xl"></div>
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-800 p-6">
              <Skull className="h-12 w-12 animate-bounce text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-4 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-4xl font-bold text-transparent text-white">
            {title}
          </h1>

          {/* Fun message */}
          <div className="mb-6 rounded-lg border border-slate-600 bg-slate-700/50 p-4">
            <p className="mb-2 text-lg font-semibold text-gray-200">
              {isClient
                ? randomMessage
                : 'You rolled a natural 1 on your website navigation check!'}
            </p>
            <p className="text-sm text-gray-400 italic">
              &ldquo;
              {isClient
                ? randomTip
                : "Try refreshing the page (it's like casting Revivify)"}
              &rdquo;
            </p>
          </div>

          {/* Error details if provided */}
          {(description || error) && (
            <div className="mb-6 rounded-lg border border-slate-600 bg-slate-900/50 p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-white">
                <Shield className="h-4 w-4 text-blue-400" />
                Technical Details
              </h3>
              <p className="text-left font-mono text-sm break-words text-gray-300">
                {description ||
                  error?.message ||
                  'An unexpected error occurred'}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            {showRetry && (
              <button
                onClick={handleRetry}
                className="group flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-white shadow-lg transition-all hover:scale-105 hover:from-emerald-700 hover:to-emerald-800 hover:shadow-emerald-500/25"
              >
                <RefreshCw className="h-5 w-5 transition-transform duration-500 group-hover:rotate-180" />
                <span className="font-semibold">Roll Again</span>
              </button>
            )}

            {showHome && (
              <button
                onClick={handleHome}
                className="group flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-3 text-white shadow-lg transition-all hover:scale-105 hover:from-slate-700 hover:to-slate-800 hover:shadow-slate-500/25"
              >
                <Home className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="font-semibold">Return to Tavern</span>
              </button>
            )}
          </div>

          {/* Footer message */}
          <div className="mt-8 border-t border-slate-600 pt-6">
            <p className="text-xs text-gray-400">
              💀 Even the greatest heroes sometimes fail their saving throws 💀
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
