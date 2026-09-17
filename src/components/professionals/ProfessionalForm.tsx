'use client';

import { useState } from 'react';
import { Professional, Service } from '@/types/database';
import { createProfessionalAction, updateProfessionalAction } from '@/app/(dashboard)/cadastros/profissionais/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { UserCheck, Phone, Mail, Percent, DollarSign, Loader2, Check } from 'lucide-react';
import Link from 'next/link';

interface ProfessionalFormProps {
  professional?: Professional;
  services: Service[];
  initialSelectedServiceIds?: string[];
}

export function ProfessionalForm({
  professional,
  services,
  initialSelectedServiceIds = [],
}: ProfessionalFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commissionType, setCommissionType] = useState<string>(professional?.commission_type || 'none');
  const [selectedServices, setSelectedServices] = useState<string[]>(initialSelectedServiceIds);

  function toggleService(serviceId: string) {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((id) => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
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
