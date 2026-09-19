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
          className={`flex items-center justify-center bg-purple-600 text-white rounded-lg p-1.5 shadow ${appliedClassName}`}
        >
          <Crown className="h-5 w-5" />
        </div>
      );
    }

    return (
      <div 
        style={height ? { height: `${height}px` } : undefined}
        className={`flex items-center gap-2 font-bold text-lg text-white ${appliedClassName}`}
      >
        <div className="p-1.5 bg-purple-600 text-white rounded-lg shadow">
          <Crown className="h-5 w-5" />
        </div>
        <span>Cabellos</span>
      </div>
    );
  }

  return (
    <img
      src={srcUrl}
      alt={altText}
      onError={() => setHasError(true)}
      style={height ? { height: `${height}px` } : undefined}
      className={`object-contain ${appliedClassName}`}
    />
  );
}
