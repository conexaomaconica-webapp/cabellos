'use client';

import { useState, useMemo } from 'react';
import { Client, Professional, Service, PaymentMethod, ProfessionalService } from '@/types/database';
import { completeAppointmentAction, quickCreateClientAction } from '@/app/(dashboard)/atendimentos/actions';
import { formatCurrency, formatPhoneNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Wrench,
  UserCheck,
  CreditCard,
  CheckCircle2,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

interface NewAppointmentFormProps {
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  paymentMethods: PaymentMethod[];
  professionalServices: ProfessionalService[];
}

interface ServiceItem {
  serviceId: string;
  professionalId: string;
  quantity: number;
  discount: number;
}

interface PaymentItem {
  paymentMethodId: string;
  amount: number;
}

export function NewAppointmentForm({
  clients: initialClients,
  professionals,
  services,
  paymentMethods,
  professionalServices,
}: NewAppointmentFormProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [selectedMainProfId, setSelectedMainProfId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Items do Atendimento
  const [items, setItems] = useState<ServiceItem[]>([]);

  // Pagamentos
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');

  // Modal Cadastro Rápido de Cliente
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickWhatsapp, setQuickWhatsapp] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Estado geral
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clientes filtrados para a busca
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 5);
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.whatsapp && c.whatsapp.includes(q))
    ).slice(0, 8);
  }, [clients, clientSearch]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Adicionar Serviço ao Atendimento
  function handleAddService(serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    // Achar primeiro profissional habilitado
    const linkedProfIds = professionalServices
      .filter((ps) => ps.service_id === serviceId)
      .map((ps) => ps.professional_id);

    const defaultProfId =
      selectedMainProfId && linkedProfIds.includes(selectedMainProfId)
        ? selectedMainProfId
        : linkedProfIds[0] || (professionals[0]?.id || '');

    setItems((prev) => [
      ...prev,
      {
        serviceId,
        professionalId: defaultProfId,
        quantity: 1,
        discount: 0,
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateItem(index: number, field: keyof ServiceItem, value: any) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  // Cálculos Monetários em Tempo Real
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (!service) return acc;
      // Checar se o profissional tem custom_price
      const profSvc = professionalServices.find(
        (ps) => ps.service_id === item.serviceId && ps.professional_id === item.professionalId
      );
      const unitPrice = profSvc?.custom_price || service.price;
      return acc + unitPrice * item.quantity;
    }, 0);
  }, [items, services, professionalServices]);

  const totalDiscount = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.discount || 0), 0);
  }, [items]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - totalDiscount);
  }, [subtotal, totalDiscount]);

  const paymentsSum = useMemo(() => {
    return payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [payments]);

  // Atualizar pagamentos no modo Single
  function handleSinglePaymentMethodChange(paymentMethodId: string) {
    setPayments([{ paymentMethodId, amount: total }]);
  }

  // Modal de Cadastro Rápido de Cliente
  async function handleQuickCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setQuickError(null);
    setQuickLoading(true);

    const res = await quickCreateClientAction(quickName, quickWhatsapp);
    if (res.error || !res.client) {
      setQuickError(res.error || 'Erro ao cadastrar cliente');
      setQuickLoading(false);
    } else {
      setClients((prev) => [res.client!, ...prev]);
      setSelectedClientId(res.client.id);
      setIsQuickClientOpen(false);
      setQuickName('');
      setQuickWhatsapp('');
      setQuickLoading(false);
    }
  }

  // Submeter Atendimento
  async function handleSubmit() {
    setError(null);

    if (!selectedClientId) {
      setError('Selecione um cliente para o atendimento.');
      return;
    }

    if (items.length === 0) {
      setError('Adicione pelo menos um serviço ao atendimento.');
      return;
    }

    if (paymentsSum > total) {
      setError(`A soma dos pagamentos (${formatCurrency(paymentsSum)}) não pode superar o valor do atendimento (${formatCurrency(total)}).`);
      return;
    }

    setLoading(true);

    const res = await completeAppointmentAction({
      client_id: selectedClientId,
      professional_id: selectedMainProfId || null,
      notes: notes || null,
      services: items.map((it) => ({
        service_id: it.serviceId,
        professional_id: it.professionalId || null,
        quantity: it.quantity,
        discount: it.discount,
      })),
      payments: payments.map((p) => ({
        payment_method_id: p.paymentMethodId,
        amount: p.amount,
      })),
    });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-950/60 border border-red-800 p-4 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* SEÇÃO 1: SELEÇÃO DE CLIENTE */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" /> 1. Cliente
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickClientOpen(true)}
              className="border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Cadastro Rápido
            </Button>
          </div>

          {selectedClient ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div>
                <p className="font-bold text-base text-amber-400">{selectedClient.name}</p>
                {selectedClient.whatsapp && (
                  <p className="text-xs text-slate-300">
                    WhatsApp: {formatPhoneNumber(selectedClient.whatsapp)}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedClientId('')}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Trocar Cliente
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente por nome ou WhatsApp..."
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClientId(c.id)}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-amber-500/50 text-left transition-all"
                  >
                    <div>
                      <p className="font-semibold text-sm text-slate-100">{c.name}</p>
                      <p className="text-xs text-slate-400">
                        {c.whatsapp ? formatPhoneNumber(c.whatsapp) : 'Sem WhatsApp'}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                      Selecionar
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 2: SERVIÇOS E PROFISSIONAIS */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench className="h-5 w-5 text-purple-400" /> 2. Serviços & Profissionais
            </h2>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Profissional Responsável:</span>
              <select
                value={selectedMainProfId}
                onChange={(e) => setSelectedMainProfId(e.target.value)}
                className="h-9 px-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Nenhum principal</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Adicionar Serviço por Botões Rápidos */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Selecione o Serviço para Adicionar:
            </label>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleAddService(s.id)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-purple-500/50 flex items-center gap-2 transition-all shadow-sm"
                >
                  <span>{s.name}</span>
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-300 text-[10px]">
                    R$ {s.price}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Serviços Adicionados */}
          {items.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Serviços Adicionados ({items.length})
              </p>
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const service = services.find((s) => s.id === item.serviceId);
                  if (!service) return null;

                  const linkedProfIds = professionalServices
                    .filter((ps) => ps.service_id === item.serviceId)
                    .map((ps) => ps.professional_id);

                  const profSvc = professionalServices.find(
                    (ps) => ps.service_id === item.serviceId && ps.professional_id === item.professionalId
                  );
                  const unitPrice = profSvc?.custom_price || service.price;
                  const itemTotal = unitPrice * item.quantity - item.discount;

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{service.name}</span>
                          <span className="text-xs text-slate-400">({service.duration_minutes} min)</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400">Profissional Executante</label>
                          <select
                            value={item.professionalId}
                            onChange={(e) => handleUpdateItem(idx, 'professionalId', e.target.value)}
                            className="w-full h-9 px-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-purple-500"
                          >
                            {professionals
                              .filter((p) => linkedProfIds.includes(p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-400">Qtd & Preço Unitário</label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className="h-9 w-16 bg-slate-800 border-slate-700 text-white text-xs text-center"
                            />
                            <span className="text-xs text-slate-400">x R$ {unitPrice}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-400">Desconto (R$)</label>
                          <div className="flex items-center justify-between">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.discount}
                              onChange={(e) => handleUpdateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                              className="h-9 w-24 bg-slate-800 border-slate-700 text-white text-xs"
                            />
                            <span className="text-xs font-bold text-amber-400">
                              {formatCurrency(itemTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 3: FORMAS DE PAGAMENTO */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-400" /> 3. Pagamento
            </h2>

            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('single');
                  setPayments(paymentMethods[0] ? [{ paymentMethodId: paymentMethods[0].id, amount: total }] : []);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  paymentMode === 'single' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400'
                }`}
              >
                Pagamento Único
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('split');
                  setPayments([]);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  paymentMode === 'split' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400'
                }`}
              >
                Pagamento Dividido
              </button>
            </div>
          </div>

          {paymentMode === 'single' ? (
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-300">Forma de Pagamento</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {paymentMethods.map((pm) => {
                  const isSelected = payments[0]?.paymentMethodId === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => handleSinglePaymentMethodChange(pm.id)}
                      className={`p-3 rounded-xl border text-center text-xs transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold shadow'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {pm.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Adicione as formas de pagamento divididas:</p>
              <div className="space-y-2">
                {paymentMethods.map((pm) => {
                  const pItem = payments.find((p) => p.paymentMethodId === pm.id);
                  const currentAmount = pItem?.amount || 0;

                  return (
                    <div
                      key={pm.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                    >
                      <span className="text-xs font-medium text-slate-200">{pm.name}</span>
                      <div className="flex items-center gap-2">
                        <CurrencyInput
                          value={currentAmount}
                          onChangeValue={(val) => {
                            setPayments((prev) => {
                              const filtered = prev.filter((p) => p.paymentMethodId !== pm.id);
                              if (val > 0) {
                                return [...filtered, { paymentMethodId: pm.id, amount: val }];
                              }
                              return filtered;
                            });
                          }}
                          className="h-9 w-32 bg-slate-800 border-slate-700 text-white text-xs text-right font-semibold"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resumo dos Valores de Pagamento */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
            <span className="text-slate-300">Soma dos Pagamentos Informados:</span>
            <span
              className={`font-bold ${
                paymentsSum === total
                  ? 'text-emerald-400'
                  : paymentsSum > total
                  ? 'text-red-400'
                  : 'text-amber-400'
              }`}
            >
              {formatCurrency(paymentsSum)} / Total {formatCurrency(total)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* RESUMO DE VALORES E BOTÃO CONCLUIR */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-2xl sticky bottom-2 z-30">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <span className="text-xs text-slate-400">Subtotal: {formatCurrency(subtotal)}</span>
              {totalDiscount > 0 && (
                <span className="text-xs text-amber-400">Desconto: -{formatCurrency(totalDiscount)}</span>
              )}
            </div>
            <div className="text-2xl font-extrabold text-white flex items-center gap-2">
              <span>Total:</span>
              <span className="text-amber-400">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/atendimentos" className="w-1/2 sm:w-auto">
              <Button type="button" variant="secondary" className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300">
                Cancelar
              </Button>
            </Link>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-1/2 sm:w-auto h-12 px-8 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base shadow-xl"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Concluindo...
                </span>
              ) : (
                'Concluir Atendimento'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MODAL DE CADASTRO RÁPIDO DE CLIENTE */}
      {isQuickClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in-50">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white shadow-2xl relative">
            <button
              onClick={() => setIsQuickClientOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Cadastro Rápido de Cliente</h3>
                  <p className="text-xs text-slate-400">Cadastre para continuar o atendimento</p>
                </div>
              </div>

              {quickError && (
                <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-300">
                  {quickError}
                </div>
              )}

              <form onSubmit={handleQuickCreateClient} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Nome Completo *</label>
                  <Input
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Nome do cliente"
                    required
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">WhatsApp</label>
                  <Input
                    value={quickWhatsapp}
                    onChange={(e) => setQuickWhatsapp(e.target.value)}
                    placeholder="(75) 99999-9999"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setIsQuickClientOpen(false)} className="bg-slate-800 text-slate-300">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={quickLoading} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                    {quickLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar e Selecionar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
