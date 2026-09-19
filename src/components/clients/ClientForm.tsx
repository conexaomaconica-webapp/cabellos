'use client';

import { useState } from 'react';
import { Client, Professional, Service } from '@/types/database';
import { createClientAction, updateClientAction, inactivateClientAction, checkDuplicateClientAction } from '@/app/(dashboard)/clientes/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { User, Phone, MessageSquare, Mail, Calendar, Sparkles, Loader2, AlertTriangle, Archive, Smartphone } from 'lucide-react';
import Link from 'next/link';

interface ClientFormProps {
  client?: Client;
  professionals: Professional[];
  services: Service[];
}

export function ClientForm({ client, professionals, services }: ClientFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inactivating, setInactivating] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [whatsapp, setWhatsapp] = useState(client?.whatsapp || '');
  const [email, setEmail] = useState(client?.email || '');

  async function handlePickSingleContact() {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      try {
        const raw = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: false });
        if (raw && raw[0]) {
          const c = raw[0];
          const pickedName = Array.isArray(c.name) ? c.name[0] : c.name || '';
          const pickedTel = Array.isArray(c.tel) ? c.tel[0] : c.tel || '';
          const pickedEmail = Array.isArray(c.email) ? c.email[0] : c.email || '';

          if (pickedName) setName(pickedName);
          if (pickedTel) {
            setWhatsapp(pickedTel);
            setPhone(pickedTel);
          }
          if (pickedEmail) setEmail(pickedEmail);
        }
      } catch (e) {
        // Ignora se cancelado
      }
    }
  }

  async function handleCheckDuplicate() {
    if (client) return; // Don't check on edit mode
    const res = await checkDuplicateClientAction(phone, whatsapp);
    if (res.duplicates && res.duplicates.length > 0) {
      const dup = res.duplicates[0];
      setDuplicateWarning(`Atenção: Já existe um cliente cadastrado com este telefone (${dup.name}).`);
    } else {
      setDuplicateWarning(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let res;

    if (client) {
      res = await updateClientAction(client.id, formData);
    } else {
      res = await createClientAction(formData);
    }

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  async function handleInactivate() {
    if (!client) return;
    if (!confirm('Deseja realmente inativar este cliente? Ele não será excluído fisicamente para preservar o histórico.')) return;

    setInactivating(true);
    const res = await inactivateClientAction(client.id);
    if (res?.error) {
      setError(res.error);
      setInactivating(false);
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
      <CardContent className="p-6">
        {!client && typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window && (
          <div className="mb-6 flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Smartphone className="h-4 w-4 text-emerald-400" />
              <span>Preencher com contato da agenda do celular?</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePickSingleContact}
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs gap-1 h-8"
            >
              <Smartphone className="h-3.5 w-3.5" /> Puxar Contato
            </Button>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {duplicateWarning && (
          <div className="mb-6 rounded-lg bg-amber-950/60 border border-amber-800/80 p-3 text-sm text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Nome do Cliente <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                required
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">WhatsApp</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  onBlur={handleCheckDuplicate}
                  placeholder="(75) 99999-9999"
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Telefone Secundário</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={handleCheckDuplicate}
                  placeholder="(75) 3333-2222"
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Data de Nascimento</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  name="birth_date"
                  type="date"
                  defaultValue={client?.birth_date || ''}
                  className="pl-9 bg-slate-800 border-slate-700 text-white focus-visible:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Profissional Preferido</label>
              <select
                name="preferred_professional_id"
                defaultValue={client?.preferred_professional_id || ''}
                className="w-full h-11 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <option value="">Nenhum preferido</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Serviço Habitual</label>
              <select
                name="preferred_service_id"
                defaultValue={client?.preferred_service_id || ''}
                className="w-full h-11 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <option value="">Nenhum preferido</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (R$ {s.price})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Frequência Manual de Retorno (Dias)</span>
              <span className="text-amber-400 font-mono text-xs">Prioritário no cálculo</span>
            </label>
            <Input
              name="custom_return_interval_days"
              type="number"
              min="1"
              max="365"
              defaultValue={client?.custom_return_interval_days || ''}
              placeholder="Ex: 15 (dias)"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Observações Internas</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={client?.notes || ''}
              placeholder="Preferências de horário, sensibilidade a produtos, estilo..."
              className="w-full rounded-lg bg-slate-800 border border-slate-700 p-3 text-sm text-white placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allow_whatsapp"
                name="allow_whatsapp"
                defaultChecked={client ? client.allow_whatsapp : true}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="allow_whatsapp" className="text-xs text-slate-300">
                Permitir contato de retorno via WhatsApp
              </label>
            </div>

            {client && client.is_active && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleInactivate}
                disabled={inactivating}
                className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300"
              >
                {inactivating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-1.5" /> Arquivar Cliente
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link href="/clientes">
              <Button type="button" variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-300">
                Cancelar
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-6 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </span>
              ) : client ? (
                'Atualizar Cliente'
              ) : (
                'Salvar Cliente'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
