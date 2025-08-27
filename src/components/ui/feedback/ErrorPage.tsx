'use client';

import React, { useState, useEffect } from 'react';
import { Dice1, Dice6, RefreshCw, Home, Skull, Shield, Wand2 } from 'lucide-react';

interface ErrorPageProps {
  error?: Error;
  reset?: () => void;
  title?: string;
  description?: string;
  showRetry?: boolean;
  showHome?: boolean;
}

const errorMessages = [
  "You rolled a natural 1 on your website navigation check!",
  "The dungeon master has decreed that this page doesn't exist in this reality.",
  "A wild bug appeared! It used 'Break Everything'. It's super effective!",
  "Your character sheet got eaten by a mimic disguised as a webpage.",
  "The dice gods are not pleased with your internet connection.",
  "A gelatinous cube absorbed this page. Roll for initiative!",
  "This page got turned to stone by a basilisk. Someone cast Greater Restoration!",
  "A dragon breathed fire on the server hosting this page.",
  "The page you're looking for got polymorphed into a sheep.",
  "Critical fumble! Your browser attack missed spectacularly.",
  "The server rolled a 1 on its Constitution saving throw and collapsed.",
  "A Disintegrate spell was cast on this page's code.",
  "The webpage got caught in a Maze spell and can't find its way back.",
  "A Lich drained all the life force from this page.",
  "The page fell into a Bag of Holding and got lost in the Astral Plane.",
  "A Beholder's anti-magic cone nullified this webpage's existence.",
  "The code got cursed by a Warlock patron with trust issues.",
  "This page was sacrificed to summon a greater website (it didn't work).",
  "A Tarrasque stepped on the server. Surprisingly, that wasn't the worst thing to happen today.",
  "The page got stuck in a time loop. Wait, the page got stuck in a time loop. Wait...",
  "A Rust Monster ate all the metal components in the server.",
  "The webpage was banished to the Shadowfell by an angry DM.",
];

const recoveryTips = [
  "Try refreshing the page (it's like casting Revivify)",
  "Check your internet connection (maybe you're in a dead magic zone)",
  "Clear your browser cache (banish those cursed cookies)",
  "Wait a moment and try again (sometimes magic needs time to recharge)",
  "If all else fails, blame the bard",
  "Roll for initiative and try a different approach",
  "Cast Dispel Magic on your browser and try again",
  "Check if you have enough spell slots for this webpage",
  "Make sure you're not in a zone of silence (no internet)",
  "Try turning your device off and on again (technological Lesser Restoration)",
  "Sacrifice a USB cable to the tech gods",
  "Have you tried not rolling a 1 this time?",
  "Maybe this page needs a short rest to recover",
  "Check your browser's spell components (cookies and cache)",
  "Ensure your internet connection isn't being blocked by a Wall of Force",
  "Try using a different browser (multiclassing might help)",
  "Make sure you're not under the effect of a Confusion spell",
];

export default function ErrorPage({
  error,
  reset,
  title = "Critical Failure!",
  description,
  showRetry = true,
  showHome = true
}: ErrorPageProps) {
  const [randomMessage, setRandomMessage] = useState("");
  const [randomTip, setRandomTip] = useState("");
  const [isClient, setIsClient] = useState(false);



  // Only set random messages on client side to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
    setRandomMessage(errorMessages[Math.floor(Math.random() * errorMessages.length)]);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-400 rounded-full animate-ping opacity-30"></div>
        <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-orange-400 rounded-full animate-pulse opacity-40"></div>
        <div className="absolute top-1/2 left-1/6 w-1 h-1 bg-yellow-400 rounded-full animate-bounce opacity-50"></div>
        <div className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-red-300 rounded-full animate-pulse opacity-30"></div>
        
        {/* Floating dice */}
        <div className="absolute top-20 left-20 animate-float">
          <Dice1 className="w-8 h-8 text-red-300 opacity-20 transform rotate-12" />
        </div>
        <div className="absolute top-40 right-32 animate-float-delayed">
          <Dice6 className="w-6 h-6 text-orange-300 opacity-25 transform -rotate-12" />
        </div>
        <div className="absolute bottom-32 left-40 animate-float-slow">
          <Wand2 className="w-10 h-10 text-purple-300 opacity-15 transform rotate-45" />
        </div>
      </div>

      {/* Main error content */}
      <div className="relative z-10 max-w-2xl w-full">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-2xl border border-red-500/30 p-8 text-center">
          {/* Skull icon with glow effect */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-red-600 to-red-800 rounded-full p-6 mx-auto w-24 h-24 flex items-center justify-center">
              <Skull className="w-12 h-12 text-white animate-bounce" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
            {title}
          </h1>

          {/* Fun message */}
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6 border border-slate-600">
            <p className="text-lg text-gray-200 font-semibold mb-2">
              {isClient ? randomMessage : "You rolled a natural 1 on your website navigation check!"}
            </p>
            <p className="text-sm text-gray-400 italic">
              &ldquo;{isClient ? randomTip : "Try refreshing the page (it's like casting Revivify)"}&rdquo;
            </p>
          </div>

          {/* Error details if provided */}
          {(description || error) && (
            <div className="bg-slate-900/50 rounded-lg p-4 mb-6 border border-slate-600">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Technical Details
              </h3>
              <p className="text-sm text-gray-300 text-left font-mono break-words">
                {description || error?.message || 'An unexpected error occurred'}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {showRetry && (
              <button
                onClick={handleRetry}
                className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-emerald-500/25 transform hover:scale-105"
              >
                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                <span className="font-semibold">Roll Again</span>
              </button>
            )}
            
            {showHome && (
              <button
                onClick={handleHome}
                className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg hover:shadow-slate-500/25 transform hover:scale-105"
              >
                <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Return to Tavern</span>
              </button>
            )}
          </div>

          {/* Footer message */}
          <div className="mt-8 pt-6 border-t border-slate-600">
            <p className="text-xs text-gray-400">
              💀 Even the greatest heroes sometimes fail their saving throws 💀
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}