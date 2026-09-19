'use client';

import { useState, useRef } from 'react';
import { createOrganizationAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Phone, MessageSquare, Palette, Loader2, CheckCircle2, UploadCloud, ImagePlus, Trash2 } from 'lucide-react';

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('O tamanho da logomarca deve ser de no máximo 5MB.');
        return;
      }
      setError(null);
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  }

  function handleRemoveLogo() {
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-100 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Building2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Configurar seu Estabelecimento
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
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
            {/* Campo de Logomarca */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Logomarca do Estabelecimento</span>
                <span className="text-slate-500 text-[11px]">Opcional (PNG, JPG, SVG até 5MB)</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                name="logo"
                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                onChange={handleLogoChange}
                className="hidden"
              />

              {logoPreview ? (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/70 border border-slate-300 dark:border-slate-700">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-600 bg-slate-100 dark:bg-slate-950 flex items-center justify-center shadow">
                    <img src={logoPreview} alt="Logomarca Preview" className="h-full w-full object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">Logomarca Selecionada</p>
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Pronta para envio
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 text-xs border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-200"
                    >
                      Alterar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="h-8 w-8 p-0 text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-slate-50 dark:bg-slate-800"
                      title="Remover imagem"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/50 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition-all text-center group"
                >
                  <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-amber-400 group-hover:border-amber-500/30 transition-all mb-1.5">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-amber-300 transition-colors">
                    Clique para selecionar a Logomarca
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Formatos suportados: PNG, JPG, WEBP, SVG (max 5MB)
                  </p>
                </div>
              )}
            </div>

            {/* Nome do Estabelecimento */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Nome do Estabelecimento <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                <Input
                  name="name"
                  type="text"
                  placeholder="Ex: Salão Bella ou Barbearia Alfa"
                  required
                  className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Telefone Fixo / Contato</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <Input
                    name="phone"
                    type="text"
                    placeholder="(75) 3333-0000"
                    className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">WhatsApp de Atendimento</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <Input
                    name="whatsapp"
                    type="text"
                    placeholder="(75) 99999-8888"
                    className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Cor Primária */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Cor Primária da Marca</span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{primaryColor}</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Palette className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <input
                    type="color"
                    name="primary_color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1"
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

            <div className="rounded-xl bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> O que será gerado automaticamente:
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Sua conta será configurada como <strong>Administrador</strong> do estabelecimento</li>
                <li>Categorias padrão de serviços (Cabelo, Barba, Unhas, Estética)</li>
                <li>Ambiente isolado e seguro de dados por tenant com logomarca personalizada</li>
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
