'use client';

import { useState } from 'react';
import { ClientServiceFrequency, ClientContact } from '@/types/database';
import { setManualServiceFrequencyAction } from '@/app/(dashboard)/clientes/actions';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Clock, MessageSquare, Edit2, Loader2, Wrench, UserCheck2 } from 'lucide-react';

interface ClientServiceFrequenciesProps {
  clientId: string;
  frequencies: ClientServiceFrequency[];
  contacts: ClientContact[];
}

export function ClientServiceFrequencies({ clientId, frequencies, contacts }: ClientServiceFrequenciesProps) {
  const [selectedFreq, setSelectedFreq] = useState<ClientServiceFrequency | null>(null);
  const [manualDays, setManualDays] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenEdit(freq: ClientServiceFrequency) {
    setSelectedFreq(freq);
    setManualDays(freq.manual_interval_days ? String(freq.manual_interval_days) : '');
    setError(null);
  }

  async function handleSaveManual() {
    if (!selectedFreq) return;
    setLoading(true);
    setError(null);

    const val = manualDays ? parseInt(manualDays) : null;
    const res = await setManualServiceFrequencyAction({
      client_id: clientId,
      service_id: selectedFreq.service_id,
      manual_interval_days: val,
    });

    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setSelectedFreq(null);
      window.location.reload();
    }
  }

  return (
    <div className="space-y-6">
      {/* FREQUÊNCIA POR SERVIÇO */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
        <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" /> Frequência Recorrente por Serviço
          </CardTitle>
          <Badge variant="outline" className="border-slate-700 text-slate-300">
            {frequencies.length} Serviço(s)
          </Badge>
        </CardHeader>
        <CardContent className="p-6">
          {frequencies.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-6">
              Nenhuma frequência de serviço registrada ainda para este cliente.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {frequencies.map((freq) => (
                <div key={freq.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                        <Wrench className="h-4 w-4 text-purple-400" /> {freq.service?.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Visitas:{' '}
                        <span className="font-semibold text-slate-200">{freq.visit_count}</span>
                      </p>
                    </div>
                    <Badge
                      variant={
                        freq.confidence_level === 'high'
                          ? 'success'
                          : freq.confidence_level === 'medium'
                          ? 'warning'
                          : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {freq.calculation_mode === 'manual'
                        ? 'Manual'
                        : `Confiança ${freq.confidence_level === 'high' ? 'Alta' : freq.confidence_level === 'medium' ? 'Média' : 'Baixa'}`}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">Intervalo Efetivo:</span>
                      <span className="font-bold text-amber-400">{freq.effective_interval_days} dias</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Média Automática:</span>
                      <span className="font-semibold text-slate-300">
                        {freq.average_interval_days ? `${freq.average_interval_days}d` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Profissional Habitual:</span>
                      <span className="font-semibold text-slate-200">
                        {freq.last_professional?.name || 'Não especificado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Próximo Retorno:</span>
                      <span className="font-bold text-emerald-400">
                        {freq.next_expected_return_at ? formatDate(freq.next_expected_return_at) : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(freq)}
                      className="border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar Frequência Manual
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* HISTÓRICO DE CONTATOS */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
        <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-400" /> Histórico de Contatos Efetuados
          </CardTitle>
          <Badge variant="outline" className="border-slate-700 text-slate-300">
            {contacts.length} Contato(s)
          </Badge>
        </CardHeader>
        <CardContent className="p-6">
          {contacts.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-6">
              Nenhum contato registrado no histórico do cliente.
            </p>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase text-emerald-400 border-emerald-500/30">
                        {c.contact_type}
                      </Badge>
                      <span className="text-slate-400 font-mono">{formatDate(c.contacted_at)}</span>
                    </div>
                    <Badge
                      variant={c.result === 'sent' || c.result === 'scheduled' || c.result === 'returned' ? 'success' : 'secondary'}
                      className="text-[10px]"
                    >
                      {c.result}
                    </Badge>
                  </div>
                  <p className="text-slate-200 font-mono bg-slate-900 p-2 rounded-lg border border-slate-800/80">
                    &quot;{c.message_content}&quot;
                  </p>
                  {c.notes && <p className="text-[11px] text-slate-400 italic">Obs: {c.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Frequência Manual */}
      {selectedFreq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" /> Frequência Manual: {selectedFreq.service?.name}
            </h3>

            {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">
                  Intervalo Manual em Dias (Deixe em branco para remover)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={manualDays}
                  onChange={(e) => setManualDays(e.target.value)}
                  placeholder="Ex: 15"
                  className="bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Ao salvar ou remover, o ciclo e o alerta de retorno serão recalculados atomicamente.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <Button variant="ghost" onClick={() => setSelectedFreq(null)} className="text-slate-400 text-xs">
                Cancelar
              </Button>
              <Button onClick={handleSaveManual} disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold text-xs">
                {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar Frequência
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
