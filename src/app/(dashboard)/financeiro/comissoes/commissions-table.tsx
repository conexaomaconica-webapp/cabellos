'use client';

import { useState } from 'react';
import { Commission } from '@/types/database';
import { calculateCommissionsAction, approveCommissionAction } from '../actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, ChevronDown, ChevronUp, DollarSign, Calculator, AlertCircle, RefreshCw } from 'lucide-react';

interface CommissionsTableProps {
  commissions: (Commission & {
    professional?: { name: string };
    commission_items?: Array<{
      id: string;
      production_amount: number;
      commission_amount: number;
      appointment_service?: {
        appointment_id: string;
        service?: { name: string };
      };
    }>;
  })[];
}

export function CommissionsTable({ commissions }: CommissionsTableProps) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (!startDate || !endDate) {
      setErrorMsg('Selecione as datas de início e fim.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await calculateCommissionsAction(startDate, endDate);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg('Apuração de comissões calculada com sucesso!');
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Deseja aprovar esta comissão e gerar a conta a pagar correspondente?')) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await approveCommissionAction(id);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg('Comissão aprovada com sucesso! Conta a pagar gerada.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Filter & Trigger Calculation */}
      <Card className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-amber-400" /> Nova Apuração de Comissão
        </h2>

        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-400 font-medium">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-400 font-medium">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <Button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
            Apurar Comissões
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </Card>

      {/* Commissions History List */}
      <Card className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
        <h2 className="text-base font-semibold text-slate-200">Histórico de Apurações</h2>

        {commissions.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            Nenhuma apuração de comissão registrada no período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4 text-right">Produção Operacional</th>
                  <th className="py-3 px-4 text-right">Comissão Devida</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {commissions.map((comm) => {
                  const isExpanded = expandedId === comm.id;

                  return (
                    <>
                      <tr key={comm.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-100">
                          {comm.professional?.name || 'Profissional Desconhecido'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {new Date(comm.period_start + 'T00:00:00').toLocaleDateString('pt-BR')} até{' '}
                          {new Date(comm.period_end + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                          R$ {Number(comm.production_total).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                          R$ {Number(comm.commission_amount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {comm.status === 'calculated' && (
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">Calculada</Badge>
                          )}
                          {comm.status === 'approved' && (
                            <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/30">Aprovada (Pagar)</Badge>
                          )}
                          {comm.status === 'paid' && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Paga</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : comm.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
                            title="Ver Detalhes"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {comm.status === 'calculated' && (
                            <Button
                              size="sm"
                              onClick={() => handleApprove(comm.id)}
                              disabled={loading}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1"
                            >
                              Aprovar
                            </Button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable items details */}
                      {isExpanded && comm.commission_items && comm.commission_items.length > 0 && (
                        <tr className="bg-slate-950/80 border-t-0">
                          <td colSpan={6} className="p-4">
                            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 space-y-2">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Detalhamento dos Serviços Apurados
                              </p>
                              <div className="space-y-1 text-xs">
                                {comm.commission_items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between py-1.5 border-b border-slate-800/40 last:border-0 text-slate-300"
                                  >
                                    <span>{item.appointment_service?.service?.name || 'Serviço'}</span>
                                    <div className="flex gap-4">
                                      <span className="text-slate-400">
                                        Produção: R$ {Number(item.production_amount).toFixed(2)}
                                      </span>
                                      <span className="font-semibold text-emerald-400">
                                        Comissão: R$ {Number(item.commission_amount).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
