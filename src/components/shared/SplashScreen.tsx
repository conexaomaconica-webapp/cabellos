'use client';

import React, { useEffect, useState, useRef } from 'react';
import BrandLogo from './BrandLogo';
import { Crown } from 'lucide-react';

interface SplashScreenProps {
  splashMedia?: {
    asset_type: 'splash_video' | 'splash_image';
    public_url?: string;
    mime_type?: string;
  } | null;
  primaryLogoUrl?: string | null;
  minDurationMs?: number;
  maxDurationMs?: number;
  onFinish?: () => void;
}

export default function SplashScreen({
  splashMedia,
  primaryLogoUrl,
  minDurationMs = 1800,
  maxDurationMs = 5000,
  onFinish,
}: SplashScreenProps) {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // 1. Verificar se já exibiu na sessão
    const shown = sessionStorage.getItem('cabellos_splash_shown');
    if (shown) {
      if (onFinish) onFinish();
      return;
    }

    setVisible(true);
    startTimeRef.current = Date.now();

    // Max duration fallback timer
    const maxTimer = setTimeout(() => {
      handleClose();
    }, maxDurationMs);

    return () => clearTimeout(maxTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDurationMs]);

  const handleClose = () => {
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, minDurationMs - elapsed);

    setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem('cabellos_splash_shown', 'true');
        if (onFinish) onFinish();
      }, 500); // 500ms fadeout transition
    }, remaining);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* VÍDEO OU IMAGEM DE SPLASH */}
      {splashMedia && !mediaError ? (
        splashMedia.asset_type === 'splash_video' ? (
          <video
            autoPlay
            muted
            playsInline
            onEnded={handleClose}
            onError={() => setMediaError(true)}
            className="w-full h-full object-cover"
          >
            <source src={splashMedia.public_url} type={splashMedia.mime_type || 'video/mp4'} />
          </video>
        ) : (
          <img
            src={splashMedia.public_url}
            alt="Cabellos Splash"
            onError={() => setMediaError(true)}
            onLoad={() => {
              setTimeout(handleClose, minDurationMs);
            }}
            className="w-full h-full object-cover animate-pulse"
          />
        )
      ) : (
        /* FALLBACK: ANIMAÇÃO DA LOGO E TESOURA / CABELLOS */
        <div className="flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in-95 duration-700">
          <div className="p-5 bg-purple-600/90 text-slate-900 dark:text-white rounded-3xl shadow-2xl shadow-purple-900/50 animate-bounce">
            <Crown className="h-16 w-16" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Cabellos</h1>
            <p className="text-sm font-medium text-purple-300 tracking-wide uppercase">
              Gestão para Barbearias e Salões
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
