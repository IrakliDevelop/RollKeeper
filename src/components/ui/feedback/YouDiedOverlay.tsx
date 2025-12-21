'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

interface YouDiedOverlayProps {
  isVisible: boolean;
  onDismiss?: () => void;
  characterName?: string;
  autoDismissAfter?: number;
}

export function YouDiedOverlay({
  isVisible,
  onDismiss,
  characterName,
  autoDismissAfter = 6000,
}: YouDiedOverlayProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    'entering' | 'visible' | 'exiting' | 'hidden'
  >('hidden');
  const isExitingRef = useRef(false);
  const onDismissRef = useRef(onDismiss);

  // Keep onDismiss ref updated
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const handleDismiss = useCallback(() => {
    // Prevent multiple dismiss calls
    if (isExitingRef.current) return;
    isExitingRef.current = true;

    setAnimationPhase('exiting');
    setTimeout(() => {
      setShouldRender(false);
      setAnimationPhase('hidden');
      isExitingRef.current = false;
      onDismissRef.current?.();
    }, 1000); // Exit animation duration
  }, []);

  // Handle visibility changes
  useEffect(() => {
    if (isVisible && animationPhase === 'hidden' && !isExitingRef.current) {
      setShouldRender(true);
      setAnimationPhase('entering');

      // Transition to visible after entrance animation
      const visibleTimer = setTimeout(() => {
        setAnimationPhase('visible');
      }, 2500); // Entrance animation duration

      return () => clearTimeout(visibleTimer);
    }
  }, [isVisible, animationPhase]);

  // Auto-dismiss after delay (starts counting from when fully visible)
  useEffect(() => {
    if (animationPhase === 'visible' && autoDismissAfter > 0) {
      const dismissTimer = setTimeout(() => {
        handleDismiss();
      }, autoDismissAfter);

      return () => clearTimeout(dismissTimer);
    }
  }, [animationPhase, autoDismissAfter, handleDismiss]);

  // Handle escape key and click - allow during entering phase too
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        (animationPhase === 'visible' || animationPhase === 'entering')
      ) {
        handleDismiss();
      }
    };

    if (shouldRender) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [shouldRender, animationPhase, handleDismiss]);

  const handleClick = useCallback(() => {
    if (animationPhase === 'visible' || animationPhase === 'entering') {
      handleDismiss();
    }
  }, [animationPhase, handleDismiss]);

  if (!shouldRender) return null;

  const overlay = (
    <div
      className="you-died-overlay"
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor:
          animationPhase === 'visible' || animationPhase === 'entering'
            ? 'pointer'
            : 'default',
        overflow: 'hidden',
      }}
    >
      {/* Dark vignette background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.98) 100%)',
          animation:
            animationPhase === 'entering'
              ? 'youDiedFadeIn 2s ease-out forwards'
              : animationPhase === 'exiting'
                ? 'youDiedFadeOut 1s ease-in forwards'
                : undefined,
          opacity: animationPhase === 'visible' ? 1 : undefined,
        }}
      />

      {/* Blood-red glow effect behind text */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '300px',
          background:
            'radial-gradient(ellipse at center, rgba(139,0,0,0.3) 0%, transparent 70%)',
          animation:
            animationPhase === 'entering'
              ? 'youDiedGlow 2.5s ease-out forwards'
              : animationPhase === 'exiting'
                ? 'youDiedFadeOut 1s ease-in forwards'
                : undefined,
          opacity: animationPhase === 'visible' ? 1 : undefined,
        }}
      />

      {/* Main "YOU DIED" text */}
      <h1
        style={{
          fontFamily: 'var(--font-cinzel-decorative), serif',
          fontSize: 'clamp(3rem, 12vw, 8rem)',
          fontWeight: 400,
          color: '#8B0000',
          textShadow: `
            0 0 10px rgba(139, 0, 0, 0.8),
            0 0 20px rgba(139, 0, 0, 0.6),
            0 0 40px rgba(139, 0, 0, 0.4),
            0 0 80px rgba(139, 0, 0, 0.2)
          `,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          margin: 0,
          padding: '0 1rem',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          animation:
            animationPhase === 'entering'
              ? 'youDiedTextReveal 2.5s ease-out forwards'
              : animationPhase === 'exiting'
                ? 'youDiedTextExit 1s ease-in forwards'
                : undefined,
          opacity: animationPhase === 'visible' ? 1 : undefined,
          transform: animationPhase === 'visible' ? 'scale(1)' : undefined,
        }}
      >
        You Died
      </h1>

      {/* Character name subtitle */}
      {characterName && (
        <p
          style={{
            fontFamily: 'var(--font-cinzel-decorative), serif',
            fontSize: 'clamp(0.875rem, 3vw, 1.5rem)',
            fontWeight: 400,
            color: '#666',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            margin: '2rem 0 0 0',
            position: 'relative',
            zIndex: 1,
            animation:
              animationPhase === 'entering'
                ? 'youDiedSubtitleReveal 2.5s ease-out forwards'
                : animationPhase === 'exiting'
                  ? 'youDiedFadeOut 0.8s ease-in forwards'
                  : undefined,
            opacity: animationPhase === 'visible' ? 1 : undefined,
          }}
        >
          {characterName}
        </p>
      )}

      {/* Click to dismiss hint */}
      {(animationPhase === 'visible' || animationPhase === 'entering') && (
        <p
          style={{
            position: 'absolute',
            bottom: '3rem',
            fontFamily: 'var(--font-cinzel-decorative), serif',
            fontSize: '0.875rem',
            color: '#444',
            letterSpacing: '0.1em',
            animation: 'youDiedHintPulse 2s ease-in-out infinite',
          }}
        >
          Click anywhere to continue
        </p>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes youDiedFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes youDiedFadeOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes youDiedGlow {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          50% {
            opacity: 0;
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes youDiedTextReveal {
          0% {
            opacity: 0;
            transform: scale(1.1);
            filter: blur(10px);
          }
          30% {
            opacity: 0;
            transform: scale(1.1);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }

        @keyframes youDiedTextExit {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.95);
          }
        }

        @keyframes youDiedSubtitleReveal {
          0% {
            opacity: 0;
          }
          60% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes youDiedHintPulse {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );

  // Use portal to render at document root
  if (typeof window !== 'undefined') {
    return createPortal(overlay, document.body);
  }

  return null;
}

export default YouDiedOverlay;
