'use client';

import { useState } from 'react';
import { Appointment } from '@/types/database';
import { cancelAppointmentAction } from '@/app/(dashboard)/atendimentos/actions';
import { formatCurrency, formatDate, formatPhoneNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, UserCheck, Wrench, CreditCard, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AppointmentDetailsClientProps {
  appointment: Appointment;
}

export function AppointmentDetailsClient({ appointment }: AppointmentDetailsClientProps) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setError(null);
    setLoading(true);

    const res = await cancelAppointmentAction(appointment.id, reason);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      setIsCancelModalOpen(false);
      window.location.reload();
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/atendimentos" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar para Atendimentos
        </Link>
        <Badge
          variant={
            appointment.status === 'completed'
              ? 'success'
              : appointment.status === 'cancelled'
              ? 'destructive'
              : 'outline'
          }
        >
          {appointment.status === 'completed'
            ? 'Concluído'
            : appointment.status === 'cancelled'
            ? 'Cancelado'
            : appointment.status}
        </Badge>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
        <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-white">
              Atendimento #{appointment.id.substring(0, 8)}
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              Data: {formatDate(appointment.finished_at || appointment.created_at)}
            </p>
          </div>

          {appointment.status !== 'cancelled' && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs"
            >
              <XCircle className="h-4 w-4 mr-1.5" /> Cancelar Atendimento
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Informações do Cliente */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-4 w-4 text-amber-400" /> Cliente
            </h3>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-bold text-base text-white">{appointment.client?.name}</p>
                {appointment.client?.whatsapp && (
                  <p className="text-xs text-slate-400">
                    WhatsApp: {formatPhoneNumber(appointment.client.whatsapp)}
                  </p>
                )}
              </div>
              <Link href={`/clientes/${appointment.client_id}`}>
                <Button variant="outline" size="sm" className="border-slate-700 text-xs text-slate-300">
                  Ver Ficha
                </Button>
              </Link>
            </div>
          </div>

          {/* Serviços Executados */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-purple-400" /> Serviços Realizados
            </h3>
            <div className="space-y-2">
              {appointment.services?.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-200">{item.service?.name}</p>
                    <p className="text-[11px] text-slate-400">
                      Profissional: {item.professional?.name || appointment.professional?.name || 'Não especificado'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-400">{formatCurrency(item.total)}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.quantity}x {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagamentos Efetuados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-400" /> Pagamento
              </h3>
              <Badge
                variant={
                  appointment.payment_status === 'paid'
                    ? 'success'
                    : appointment.payment_status === 'partial'
                    ? 'warning'
                    : 'secondary'
                }
                className="text-[10px]"
              >
                {appointment.payment_status === 'paid'
                  ? 'Pago'
                  : appointment.payment_status === 'partial'
                  ? 'Pagamento Parcial'
                  : 'Pendente'}
              </Badge>
            </div>

            <div className="space-y-2">
              {appointment.payments && appointment.payments.length > 0 ? (
                appointment.payments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{pay.payment_method?.name}</span>
                      {pay.voided_at && (
                        <Badge variant="destructive" className="text-[10px]">
                          Estornado
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold text-emerald-400">{formatCurrency(pay.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  Nenhum pagamento registrado no momento (Pendente).
                </p>
              )}
            </div>
          </div>

          {/* Totais do Atendimento */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal:</span>
              <span>{formatCurrency(appointment.subtotal)}</span>
            </div>
            {appointment.discount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Desconto Aplicado:</span>
                <span>-{formatCurrency(appointment.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-700">
              <span>Total do Atendimento:</span>
              <span className="text-amber-400">{formatCurrency(appointment.total)}</span>
            </div>
          </div>

          {appointment.notes && (
            <div className="text-xs text-slate-400 italic">
              Observações: &quot;{appointment.notes}&quot;
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE CANCELAMENTO */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in-50">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Cancelar Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-300">
                Atenção: Ao cancelar, este atendimento deixará de contar nos indicadores e as métricas do cliente serão revertidas no banco. O registro será mantido em histórico.
              </p>

              {error && (
                <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Motivo do Cancelamento</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Desistência do cliente, erro no lançamento..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsCancelModalOpen(false)} className="bg-slate-800 text-slate-300">
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-500 font-bold"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Cancelamento'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
