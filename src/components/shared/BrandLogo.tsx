'use client';

import React, { useState } from 'react';
import { Crown } from 'lucide-react';

interface BrandLogoProps {
  type?: 'primary' | 'compact' | 'favicon';
  srcUrl?: string | null;
  className?: string;
  altText?: string;
  height?: number | null;
}

export default function BrandLogo({
  type = 'primary',
  srcUrl,
  className = 'h-8 w-auto',
  altText = 'Cabellos',
  height,
}: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);

  // Se houver height definido no branding, remove o "h-8" padrão da className para evitar conflito.
  const appliedClassName = height && className.includes('h-8') 
    ? className.replace('h-8', '') 
    : className;

  // Fallback Padrão Empacotado do Cabellos
  if (!srcUrl || hasError) {
    if (type === 'compact' || type === 'favicon') {
      return (
        <div 
          style={height ? { height: `${height}px` } : undefined}
          className={`flex items-center justify-center bg-purple-600 text-slate-900 dark:text-white rounded-lg p-1.5 shadow ${appliedClassName}`}
        >
          <Crown className="h-5 w-5" />
        </div>
      );
    }

    return (
      <div 
        style={height ? { height: `${height}px` } : undefined}
        className={`flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white ${appliedClassName}`}
      >
        <div className="p-1.5 bg-purple-600 text-slate-900 dark:text-white rounded-lg shadow">
          <Crown className="h-5 w-5" />
        </div>
        <span>Cabellos</span>
      </div>
    );
  }

  return (
    <>
      {/* SVG Filter invisível que transforma a cor Branca (1,1,1) em Slate-900 (#0F172A)
          sem afetar cores que não possuem muito canal Azul (como o Laranja/Amarelo).
          A matriz de cor faz: R' = R - 0.9412*B | G' = G - 0.9099*B | B' = 0.1647*B
      */}
      <svg width="0" height="0" className="hidden">
        <filter id="white-to-slate900">
          <feColorMatrix
            type="matrix"
            values="1 0 -0.9412 0 0
                    0 1 -0.9099 0 0
                    0 0  0.1647 0 0
                    0 0  0      1 0"
          />
        </filter>
      </svg>

      <img
        src={srcUrl}
        alt={altText}
        onError={() => setHasError(true)}
        style={height ? { height: `${height}px` } : undefined}
        className={`object-contain ${appliedClassName} light-logo-filter`}
      />
      <style dangerouslySetInnerHTML={{__html: `
        :root:not(.dark) .light-logo-filter {
          filter: url(#white-to-slate900);
        }
      `}} />
    </>
  );
}
