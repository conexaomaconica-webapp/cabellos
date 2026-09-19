'use client';

import { useState, useRef } from 'react';
import { Organization } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store, Phone, Image as ImageIcon, CheckCircle2, AlertTriangle, Loader2, Upload } from 'lucide-react';
import { updateOrganizationAction } from '@/app/(dashboard)/configuracoes/estabelecimento/actions';
import Image from 'next/image';

interface OrganizationSettingsClientProps {
  organization: Organization;
  userRole: string;
}

export function OrganizationSettingsClient({ organization }: OrganizationSettingsClientProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(organization.logo_url);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: organization.name,
    phone: organization.phone || '',
    whatsapp: organization.whatsapp || '',
    email: organization.email || '',
    primary_color: organization.primary_color || '#1e293b',
    secondary_color: organization.secondary_color || '#f59e0b',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('phone', formData.phone);
    submitData.append('whatsapp', formData.whatsapp);
    submitData.append('email', formData.email);
    submitData.append('primary_color', formData.primary_color);
    submitData.append('secondary_color', formData.secondary_color);
    
    if (logoFile) {
      submitData.append('logo', logoFile);
    }

    try {
      const result = await updateOrganizationAction(submitData);
      
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg(result.success || 'Configurações atualizadas com sucesso!');
        if (result.logoUrl) {
          setPreviewUrl(result.logoUrl);
          setLogoFile(null); // Clear the file since it's uploaded
        }
      }
    } catch (error) {
      setErrorMsg('Ocorreu um erro ao salvar as configurações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-amber-500" />
            Identidade do Estabelecimento
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Atualize o nome, logomarca e as cores que representam o seu negócio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome do Salão/Barbearia</label>
              <Input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Logomarca</label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                  {previewUrl ? (
                    <Image src={previewUrl} alt="Logo" width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="h-8 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3 mr-2" /> Escolher Nova
                  </Button>
                  <p className="text-[10px] text-slate-500">Recomendado: 500x500px, fundo transparente (PNG).</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 pt-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cor Primária (HEX)</label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                  className="w-12 h-10 p-1 cursor-pointer bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <Input 
                  type="text" 
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                  className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                  pattern="^#+([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cor Secundária (HEX)</label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleChange}
                  className="w-12 h-10 p-1 cursor-pointer bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <Input 
                  type="text" 
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleChange}
                  className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                  pattern="^#+([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$"
                />
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5 text-amber-500" />
            Contatos do Estabelecimento
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Estes contatos poderão ser exibidos no seu site de agendamento online e recibos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone Fixo</label>
              <Input 
                type="text" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(00) 0000-0000"
                className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">WhatsApp</label>
              <Input 
                type="text" 
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                placeholder="(00) 90000-0000"
                className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</label>
              <Input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contato@salao.com.br"
                className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 mt-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> {successMsg}
            </div>
          )}

        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button 
          type="button"
          variant="outline"
          className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
          onClick={() => window.location.reload()}
        >
          Descartar
        </Button>
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 shadow-lg"
        >
          {loading ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</span>
          ) : 'Salvar Configurações'}
        </Button>
      </div>
    </form>
  );
}
