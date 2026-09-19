'use client';

import { useState } from 'react';
import { updateReturnSettingsAction } from '@/app/(dashboard)/configuracoes/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Clock, Save, Loader2, Info } from 'lucide-react';

interface ReturnSettingsProps {
  initialSettings: {
    default_return_interval_days: number;
    minimum_visits_for_average: number;
    alert_lead_days: number;
    inactive_client_days: number;
    auto_create_alerts: boolean;
  };
}

export function ReturnSettingsClient({ initialSettings }: ReturnSettingsProps) {
  const [defaultInterval, setDefaultInterval] = useState(initialSettings.default_return_interval_days || 20);
  const [minVisits, setMinVisits] = useState(initialSettings.minimum_visits_for_average || 3);
  const [leadDays, setLeadDays] = useState(initialSettings.alert_lead_days || 7);
  const [inactiveDays, setInactiveDays] = useState(initialSettings.inactive_client_days || 60);
  const [autoCreate, setAutoCreate] = useState(initialSettings.auto_create_alerts ?? true);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await updateReturnSettingsAction({
      default_return_interval_days: Number(defaultInterval),
      minimum_visits_for_average: Number(minVisits),
      alert_lead_days: Number(leadDays),
      inactive_client_days: Number(inactiveDays),
      auto_create_alerts: autoCreate,
    });

    setLoading(false);
    if (res?.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Configurações de retorno salvas com sucesso!' });
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Clock className="h-6 w-6 text-amber-400" /> Configurações Gerais de Retorno
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Defina os parâmetros padrão de recorrência, antecedência de alertas e cálculo estatístico do estabelecimento.
        </p>
      </div>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Regras da Central de Retornos</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Parâmetros aplicados na ausência de intervalos específicos por serviço ou preferências do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  message.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-red-950/60 border-red-800 text-red-300'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Frequência Global Padrão (dias)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={defaultInterval}
                    onChange={(e) => setDefaultInterval(parseInt(e.target.value))}
                    className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Utilizada quando o serviço ou cliente não possuem padrão específico.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Mínimo de Visitas para Média Automática
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={minVisits}
                    onChange={(e) => setMinVisits(parseInt(e.target.value))}
                    className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Quantidade de visitas concluídas necessárias para ativar a média automática.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Antecedência de Alerta (dias)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={leadDays}
                    onChange={(e) => setLeadDays(parseInt(e.target.value))}
                    className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Quantos dias antes do retorno o alerta deve surgir como &quot;Próximo&quot;.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Prazo para Cliente Inativo (dias)
                  </label>
                  <Input
                    type="number"
                    min={15}
                    value={inactiveDays}
                    onChange={(e) => setInactiveDays(parseInt(e.target.value))}
                    className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Dias sem nenhum atendimento para considerar cliente inativo.
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">Criar Alertas Automatizados</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Gerar e atualizar automaticamente ciclos de retornos ao concluir atendimentos.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button type="submit" disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold text-xs shadow-lg">
                {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />} Salvar Configurações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
