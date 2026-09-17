'use client';

import { useState } from 'react';
import { createOrganizationAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Phone, MessageSquare, Palette, Loader2, CheckCircle2 } from 'lucide-react';

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#0f172a');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await createOrganizationAction(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Building2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-tight">
            Configurar seu Estabelecimento
          </CardTitle>
          <CardDescription className="text-slate-400">
            Informe os dados iniciais do seu Salão de Beleza ou Barbearia
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Nome do Estabelecimento <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="name"
                  type="text"
                  placeholder="Ex: Salão Bella ou Barbearia Alfa"
                  required
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Telefone Fixo / Contato</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    name="phone"
                    type="text"
                    placeholder="(75) 3333-0000"
                    className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">WhatsApp de Atendimento</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    name="whatsapp"
                    type="text"
                    placeholder="(75) 99999-8888"
                    className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Cor Primária da Marca</span>
                <span className="text-slate-400 font-mono text-[11px]">{primaryColor}</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Palette className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="color"
                    name="primary_color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-1"
                  />
                </div>
                <div className="flex gap-2">
                  {['#0f172a', '#1e3a8a', '#065f46', '#831843', '#78350f', '#4c1d95'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPrimaryColor(color)}
                      style={{ backgroundColor: color }}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        primaryColor === color ? 'border-amber-400 scale-110' : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-800/60 border border-slate-800 p-4 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> O que será gerado automaticamente:
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Sua conta será configurada como <strong>Proprietário (Owner)</strong></li>
                <li>Categorias padrão de serviços (Cabelo, Barba, Unhas, Estética)</li>
                <li>Ambiente isolado e seguro de dados por tenant</li>
              </ul>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-all shadow-lg text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Concluindo Onboarding...
                </span>
              ) : (
                'Concluir Cadastro e Abrir Painel'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
