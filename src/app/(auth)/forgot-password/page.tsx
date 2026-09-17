'use client';

import { useState } from 'react';
import { forgotPasswordAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scissors, Mail, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await forgotPasswordAction(formData);

    if (res?.error) {
      setError(res.error);
    } else if (res?.success) {
      setSuccess(res.success);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700 text-amber-400">
            <Scissors className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-tight">
            Recuperar Senha
          </CardTitle>
          <CardDescription className="text-slate-400">
            Digite seu e-mail cadastrado para receber o link de redefinição
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-3 text-sm text-emerald-300">
              {success}
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-all shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                </span>
              ) : (
                'Enviar Instruções'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
