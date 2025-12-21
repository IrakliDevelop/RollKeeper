'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

interface LevelUpOverlayProps {
  isVisible: boolean;
  onDismiss?: () => void;
  newLevel: number;
  characterName?: string;
  autoDismissAfter?: number;
}

export function LevelUpOverlay({
  isVisible,
  onDismiss,
  newLevel,
  characterName,
  autoDismissAfter = 4000,
}: LevelUpOverlayProps) {
  console.log('LevelUpOverlay rendered', isVisible, newLevel, characterName);
  const [shouldRender, setShouldRender] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    'entering' | 'visible' | 'exiting' | 'hidden'
  >('hidden');
  const isExitingRef = useRef(false);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const handleDismiss = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;

    setAnimationPhase('exiting');
    setTimeout(() => {
      setShouldRender(false);
      setAnimationPhase('hidden');
      isExitingRef.current = false;
      onDismissRef.current?.();
    }, 800);
  }, []);

  useEffect(() => {
    if (isVisible && animationPhase === 'hidden' && !isExitingRef.current) {
      setShouldRender(true);
      setAnimationPhase('entering');

      const visibleTimer = setTimeout(() => {
        setAnimationPhase('visible');
      }, 1500);

      return () => clearTimeout(visibleTimer);
    }
  }, [isVisible, animationPhase]);

  useEffect(() => {
    if (animationPhase === 'visible' && autoDismissAfter > 0) {
      const dismissTimer = setTimeout(() => {
        handleDismiss();
      }, autoDismissAfter);

      return () => clearTimeout(dismissTimer);
    }
  }, [animationPhase, autoDismissAfter, handleDismiss]);

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
      className="level-up-overlay"
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
      {/* Dark background with vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 70%, rgba(0,0,0,0.95) 100%)',
          animation:
            animationPhase === 'entering'
              ? 'levelUpBgFadeIn 1s ease-out forwards'
              : animationPhase === 'exiting'
                ? 'levelUpBgFadeOut 0.8s ease-in forwards'
                : undefined,
          opacity: animationPhase === 'visible' ? 1 : undefined,
        }}
      />

      {/* Light rays effect */}
      <div
        style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          background: `
            conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              rgba(255, 215, 0, 0.03) 10deg,
              transparent 20deg,
              rgba(255, 215, 0, 0.05) 30deg,
              transparent 40deg,
              rgba(255, 215, 0, 0.03) 50deg,
              transparent 60deg,
              rgba(255, 215, 0, 0.04) 70deg,
              transparent 80deg,
              rgba(255, 215, 0, 0.03) 90deg,
              transparent 100deg,
              rgba(255, 215, 0, 0.05) 110deg,
              transparent 120deg,
              rgba(255, 215, 0, 0.03) 130deg,
              transparent 140deg,
              rgba(255, 215, 0, 0.04) 150deg,
              transparent 160deg,
              rgba(255, 215, 0, 0.03) 170deg,
              transparent 180deg,
              rgba(255, 215, 0, 0.05) 190deg,
              transparent 200deg,
              rgba(255, 215, 0, 0.03) 210deg,
              transparent 220deg,
              rgba(255, 215, 0, 0.04) 230deg,
              transparent 240deg,
              rgba(255, 215, 0, 0.03) 250deg,
              transparent 260deg,
              rgba(255, 215, 0, 0.05) 270deg,
              transparent 280deg,
              rgba(255, 215, 0, 0.03) 290deg,
              transparent 300deg,
              rgba(255, 215, 0, 0.04) 310deg,
              transparent 320deg,
              rgba(255, 215, 0, 0.03) 330deg,
              transparent 340deg,
              rgba(255, 215, 0, 0.05) 350deg,
              transparent 360deg
            )
          `,
          animation:
            animationPhase === 'entering' || animationPhase === 'visible'
              ? 'levelUpRaysRotate 20s linear infinite, levelUpRaysFadeIn 1.5s ease-out forwards'
              : animationPhase === 'exiting'
                ? 'levelUpBgFadeOut 0.8s ease-in forwards'
                : undefined,
        }}
      />

      {/* Golden glow behind text */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '300px',
          background:
            'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.15) 0%, transparent 60%)',
          animation:
            animationPhase === 'entering'
              ? 'levelUpGlowPulse 2s ease-out forwards'
              : animationPhase === 'exiting'
                ? 'levelUpBgFadeOut 0.8s ease-in forwards'
                : 'levelUpGlowBreath 3s ease-in-out infinite',
          opacity: animationPhase === 'visible' ? 1 : undefined,
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          animation:
            animationPhase === 'entering'
              ? 'levelUpContentReveal 1.5s ease-out forwards'
              : animationPhase === 'exiting'
                ? 'levelUpContentExit 0.8s ease-in forwards'
                : undefined,
          opacity: animationPhase === 'visible' ? 1 : undefined,
        }}
      >
        {/* Decorative line top */}
        <div
          style={{
            width: '300px',
            height: '2px',
            background:
              'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.8), transparent)',
            margin: '0 auto 1.5rem',
            animation:
              animationPhase === 'entering'
                ? 'levelUpLineExpand 1s ease-out forwards'
                : undefined,
          }}
        />

        {/* LEVEL UP text */}
        <p
          style={{
            fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
            fontWeight: 400,
            color: 'rgba(255, 215, 0, 0.7)',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            margin: '0 0 0.5rem 0',
          }}
        >
          Level Up
        </p>

        {/* Level number */}
        <h1
          style={{
            fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
            fontSize: 'clamp(4rem, 15vw, 8rem)',
            fontWeight: 700,
            color: '#FFD700',
            textShadow: `
              0 0 20px rgba(255, 215, 0, 0.5),
              0 0 40px rgba(255, 215, 0, 0.3),
              0 0 60px rgba(255, 215, 0, 0.2),
              0 2px 4px rgba(0, 0, 0, 0.5)
            `,
            letterSpacing: '0.05em',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {newLevel}
        </h1>

        {/* Character name */}
        {characterName && (
          <p
            style={{
              fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
              fontSize: 'clamp(0.875rem, 2.5vw, 1.25rem)',
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.6)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              margin: '1rem 0 0 0',
            }}
          >
            {characterName}
          </p>
        )}

        {/* Decorative line bottom */}
        <div
          style={{
            width: '300px',
            height: '2px',
            background:
              'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.8), transparent)',
            margin: '1.5rem auto 0',
            animation:
              animationPhase === 'entering'
                ? 'levelUpLineExpand 1s ease-out forwards'
                : undefined,
          }}
        />
      </div>

      {/* Click to dismiss hint */}
      {(animationPhase === 'visible' || animationPhase === 'entering') && (
        <p
          style={{
            position: 'absolute',
            bottom: '2rem',
            fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
            fontSize: '0.75rem',
            color: 'rgba(255, 215, 0, 0.4)',
            letterSpacing: '0.1em',
            animation: 'levelUpHintPulse 2s ease-in-out infinite',
          }}
        >
          Click anywhere to continue
        </p>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes levelUpBgFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes levelUpBgFadeOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes levelUpRaysRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes levelUpRaysFadeIn {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes levelUpGlowPulse {
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

        @keyframes levelUpGlowBreath {
          0%,
          100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes levelUpContentReveal {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          40% {
            opacity: 0;
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes levelUpContentExit {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.05);
          }
        }

        @keyframes levelUpLineExpand {
          0% {
            width: 0;
            opacity: 0;
          }
          50% {
            opacity: 0;
          }
          100% {
            width: 300px;
            opacity: 1;
          }
        }

        @keyframes levelUpHintPulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );

  if (typeof window !== 'undefined') {
    return createPortal(overlay, document.body);
  }

  return null;
}

export default LevelUpOverlay;
