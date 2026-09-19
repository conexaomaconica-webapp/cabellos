'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { masterCreateOrganizationExistingAdmin } from '@/lib/master/actions';
import { PlusCircle, Building2, UserCheck, CreditCard, AlertCircle } from 'lucide-react';

export default function MasterOrgClientModal({ plans, users }: { plans: any[]; users: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    adminUserId: users[0]?.id || '',
    saasPlanId: plans[0]?.id || '',
    billingCycle: 'monthly',
    phone: '',
    whatsapp: '',
    city: '',
    state: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await masterCreateOrganizationExistingAdmin({
        name: formData.name,
        adminUserId: formData.adminUserId,
        saasPlanId: formData.saasPlanId,
        billingCycle: formData.billingCycle,
        phone: formData.phone || undefined,
        whatsapp: formData.whatsapp || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
      });

      setIsOpen(false);
      setFormData({
        name: '',
        adminUserId: users[0]?.id || '',
        saasPlanId: plans[0]?.id || '',
        billingCycle: 'monthly',
        phone: '',
        whatsapp: '',
        city: '',
        state: '',
      });
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Falha ao criar o salão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-slate-900 dark:text-white font-medium text-sm transition-all shadow-lg shadow-purple-900/30"
      >
        <PlusCircle className="h-4 w-4" /> Cadastrar Salão
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-in fade-in-50">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-400" /> Criar Salão (Cenário A - Admin Existente)
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Nome do Estabelecimento *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Studio Hair Concept"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-purple-400" /> Usuário Administrador Existente *
                </label>
                <select
                  required
                  value={formData.adminUserId}
                  onChange={(e) => setFormData({ ...formData, adminUserId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-purple-400" /> Plano SaaS *
                </label>
                <select
                  required
                  value={formData.saasPlanId}
                  onChange={(e) => setFormData({ ...formData, saasPlanId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {p.monthly_price}/mês
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Cidade</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="São Paulo"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="SP"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800 font-medium text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-slate-900 dark:text-white font-medium text-xs disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Confirmar e Provisionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
