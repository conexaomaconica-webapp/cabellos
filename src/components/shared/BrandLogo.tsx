'use client';

import React, { useState } from 'react';
import { Crown } from 'lucide-react';

interface BrandLogoProps {
  type?: 'primary' | 'compact' | 'favicon';
  srcUrl?: string | null;
  className?: string;
  altText?: string;
}

export default function BrandLogo({
  type = 'primary',
  srcUrl,
  className = 'h-8 w-auto',
  altText = 'Cabellos',
}: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);

  // Fallback Padrão Empacotado do Cabellos
  if (!srcUrl || hasError) {
    if (type === 'compact' || type === 'favicon') {
      return (
        <div className={`flex items-center justify-center bg-purple-600 text-white rounded-lg p-1.5 shadow ${className}`}>
          <Crown className="h-5 w-5" />
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2 font-bold text-lg text-white ${className}`}>
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
      className={`object-contain ${className}`}
    />
  );
}
