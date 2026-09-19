'use client';

import { useState, useRef } from 'react';
import { Professional, Service } from '@/types/database';
import { createProfessionalAction, updateProfessionalAction } from '@/app/(dashboard)/cadastros/profissionais/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { UserCheck, Phone, Mail, Percent, DollarSign, Loader2, Check, Camera, ImagePlus, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface ProfessionalFormProps {
  professional?: Professional;
  services: Service[];
  initialSelectedServiceIds?: string[];
}

const PRESET_AVATARS = [
  { id: 'barber-1', name: 'Barbeiro 1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Barber1&backgroundColor=b6e3f4' },
  { id: 'barber-2', name: 'Barbeiro 2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos&backgroundColor=c0aede' },
  { id: 'hair-1', name: 'Cabeleireira 1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julia&backgroundColor=ffd5dc' },
  { id: 'hair-2', name: 'Cabeleireira 2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana&backgroundColor=d1d4f9' },
  { id: 'stylist-1', name: 'Estilista 1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas&backgroundColor=ffdfbf' },
  { id: 'stylist-2', name: 'Estilista 2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pedro&backgroundColor=b6e3f4' },
  { id: 'beauty-1', name: 'Manicure 1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fernanda&backgroundColor=ffd5dc' },
  { id: 'beauty-2', name: 'Esteticista 2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Camila&backgroundColor=c0aede' },
];

export function ProfessionalForm({
  professional,
  services,
  initialSelectedServiceIds = [],
}: ProfessionalFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commissionType, setCommissionType] = useState<string>(professional?.commission_type || 'none');
  const [selectedServices, setSelectedServices] = useState<string[]>(initialSelectedServiceIds);

  // Estado da Foto/Avatar
  const [photoUrl, setPhotoUrl] = useState<string>(professional?.photo_url || '');
  const [photoPreview, setPhotoPreview] = useState<string | null>(professional?.photo_url || null);
  const [photoSourceMode, setPhotoSourceMode] = useState<'avatar' | 'upload'>('avatar');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleService(serviceId: string) {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((id) => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  }

  function handleSelectPresetAvatar(url: string) {
    setPhotoUrl(url);
    setPhotoPreview(url);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('A foto deve ter no máximo 5MB.');
        return;
      }
      setError(null);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setPhotoUrl(''); // O upload do arquivo gerará a URL real na Server Action
    }
  }

  function handleRemovePhoto() {
    setPhotoUrl('');
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let res;

    if (professional) {
      res = await updateProfessionalAction(professional.id, formData, selectedServices);
    } else {
      res = await createProfessionalAction(formData, selectedServices);
    }

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
      <CardContent className="p-6">
        {error && (
          <div className="mb-6 rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SEÇÃO FOTO DE PERFIL / AVATAR */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Foto de Perfil ou Avatar
            </label>

            <input type="hidden" name="photo_url" value={photoUrl} />
            <input
              ref={fileInputRef}
              type="file"
              name="photo_file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Preview Avatar */}
              <div className="relative h-20 w-20 shrink-0 rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-slate-900 flex items-center justify-center shadow-lg">
                {photoPreview ? (
                  <img src={photoPreview} alt="Avatar Preview" className="h-full w-full object-cover" />
                ) : (
                  <UserCheck className="h-10 w-10 text-slate-600" />
                )}
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-950/80 text-slate-300 hover:text-red-400 flex items-center justify-center"
                    title="Remover foto"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Controles de Seleção */}
              <div className="flex-1 space-y-3 w-full">
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs w-fit">
                  <button
                    type="button"
                    onClick={() => setPhotoSourceMode('avatar')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      photoSourceMode === 'avatar'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 inline mr-1" /> Avatares Prontos
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoSourceMode('upload')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      photoSourceMode === 'upload'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5 inline mr-1" /> Upload de Foto
                  </button>
                </div>

                {photoSourceMode === 'avatar' ? (
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Clique para escolher um avatar ilustrado:</span>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_AVATARS.map((av) => {
                        const isSelected = photoUrl === av.url;
                        return (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => handleSelectPresetAvatar(av.url)}
                            className={`h-10 w-10 rounded-xl overflow-hidden border-2 transition-all p-0.5 bg-slate-800 ${
                              isSelected
                                ? 'border-emerald-400 scale-110 shadow-md ring-2 ring-emerald-500/30'
                                : 'border-slate-700 hover:border-slate-500 opacity-80 hover:opacity-100'
                            }`}
                            title={av.name}
                          >
                            <img src={av.url} alt={av.name} className="h-full w-full object-cover rounded-lg" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                    >
                      <ImagePlus className="h-4 w-4 mr-1.5" /> Selecionar Foto do Computador (PNG, JPG)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Nome do Profissional <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                name="name"
                defaultValue={professional?.name || ''}
                placeholder="Ex: Carlos Oliveira"
                required
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="phone"
                  defaultValue={professional?.phone || ''}
                  placeholder="(75) 99999-0000"
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="email"
                  type="email"
                  defaultValue={professional?.email || ''}
                  placeholder="profissional@email.com"
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Tipo de Comissão</label>
              <select
                name="commission_type"
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="none">Sem Comissão</option>
                <option value="percentage">Porcentagem (%)</option>
                <option value="fixed">Valor Fixo (R$)</option>
              </select>
            </div>

            {commissionType !== 'none' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {commissionType === 'percentage' ? 'Porcentagem (%)' : 'Valor Fixo (R$)'}
                </label>
                <Input
                  name="commission_value"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={professional?.commission_value || 0}
                  placeholder="Ex: 30"
                  className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Seleção de Serviços Prestados */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Serviços Prestados por este Profissional
            </label>
            {services.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Nenhum serviço cadastrado na organização ainda.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {services.map((service) => {
                  const isChecked = selectedServices.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-medium'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-[11px] text-slate-400">R$ {service.price}</p>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-md flex items-center justify-center border transition-all ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-600 bg-slate-900'
                        }`}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Link href="/cadastros/profissionais">
              <Button type="button" variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-300">
                Cancelar
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </span>
              ) : professional ? (
                'Atualizar Profissional'
              ) : (
                'Salvar Profissional'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
