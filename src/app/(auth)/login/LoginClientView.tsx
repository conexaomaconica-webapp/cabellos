'use client';

import { useState, useEffect } from 'react';
import { loginAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scissors, Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { SystemBranding } from '@/types/system-assets';
import BrandLogo from '@/components/shared/BrandLogo';

export default function LoginClientView({ systemBranding }: { systemBranding: SystemBranding }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(!!systemBranding.splash?.public_url);
  const [showPassword, setShowPassword] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (showSplash && systemBranding.splash?.asset_type === 'splash_image') {
      // Se for imagem, fazemos uma barra de progresso de 10 segundos
      const duration = 10000;
      const startTime = Date.now();
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min((elapsed / duration) * 100, 100);
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
        }
      }, 50);

      const timer = setTimeout(() => setShowSplash(false), duration);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [showSplash, systemBranding.splash]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await loginAction(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  // Se o splash estiver ativo, renderizamos a tela de carregamento cobrindo tudo
  if (showSplash && systemBranding.splash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
        {systemBranding.splash.asset_type === 'splash_video' ? (
          <video
            autoPlay
            muted
            playsInline
            onTimeUpdate={(e) => {
              const current = e.currentTarget.currentTime;
              const duration = e.currentTarget.duration || 10; // Fallback para 10s se não tiver carregado
              const p = Math.min((current / duration) * 100, 100);
              setProgress(p);
            }}
            onEnded={() => setShowSplash(false)}
            className="w-48 h-48 md:w-64 md:h-64 object-contain rounded-2xl shadow-2xl"
          >
            <source src={systemBranding.splash.public_url} type={systemBranding.splash.mime_type} />
          </video>
        ) : (
          <img
            src={systemBranding.splash.public_url}
            alt="Carregando..."
            className="w-48 h-48 md:w-64 md:h-64 object-contain animate-pulse rounded-2xl shadow-2xl"
          />
        )}
        
        {/* Barra de Progresso Laranja (Cabellos) */}
        <div className="w-48 md:w-64 h-1.5 bg-slate-900 rounded-full mt-8 overflow-hidden shadow-inner">
          <div 
            className="h-full bg-amber-500 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex items-center justify-center">
            {systemBranding.logo_primary?.public_url ? (
               <BrandLogo 
                 type="primary" 
                 srcUrl={systemBranding.logo_primary.public_url} 
                 height={systemBranding.logo_primary.height || 64} 
                 className="h-16" 
               />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700 text-amber-400">
                <Scissors className="h-7 w-7" />
              </div>
            )}
          </div>
          {!systemBranding.logo_primary?.public_url && (
            <CardTitle className="text-2xl font-bold text-white tracking-tight">
              Cabellos
            </CardTitle>
          )}
          <CardDescription className="text-slate-400 mt-2">
            Entre na sua conta para acessar seu estabelecimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="email"
                  type="email"
                  placeholder="seu.email@salao.com"
                  required
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Senha</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-amber-400 hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  className="pl-9 pr-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-all shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Entrando...
                </span>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Ainda não tem conta?{' '}
            <Link href="/register" className="font-semibold text-amber-400 hover:underline">
              Criar estabelecimento
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
