'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AccountReceivable, PaymentMethod } from '@/types/database';
import { payAccountReceivableAction } from '../actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, CheckCircle2 } from 'lucide-react';

interface AccountsReceivableTableProps {
  receivables: AccountReceivable[];
  paymentMethods: PaymentMethod[];
}

export function AccountsReceivableTable({ receivables, paymentMethods }: AccountsReceivableTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedReceivable, setSelectedReceivable] = useState<AccountReceivable | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(paymentMethods[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenPayModal = (r: AccountReceivable) => {
    setSelectedReceivable(r);
    setPayAmount(Number(r.remaining_amount));
    setErrorMsg(null);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;
    setErrorMsg(null);

    if (payAmount <= 0) {
      setErrorMsg('Informe um valor maior que 0.');
      return;
    }
    if (payAmount > Number(selectedReceivable.remaining_amount)) {
      setErrorMsg(`O valor pago (R$ ${payAmount.toFixed(2)}) não pode exceder o saldo restante (R$ ${Number(selectedReceivable.remaining_amount).toFixed(2)}).`);
      return;
    }

    startTransition(async () => {
      const res = await payAccountReceivableAction(selectedReceivable.id, payAmount, paymentMethodId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSelectedReceivable(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {receivables.length === 0 ? (
        <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 italic">
          Nenhuma conta a receber cadastrada.
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Descrição / Origem</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Original</th>
                <th className="p-3.5">Pago</th>
                <th className="p-3.5">Restante</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {receivables.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30">
                  <td className="p-3.5 font-semibold text-slate-100">{r.client?.name || 'Cliente'}</td>
                  <td className="p-3.5 text-slate-300">{r.description || 'Saldo Pendente'}</td>
                  <td className="p-3.5 text-slate-400">{new Date(r.due_date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3.5">R$ {Number(r.original_amount).toFixed(2)}</td>
                  <td className="p-3.5 text-emerald-400 font-semibold">R$ {Number(r.paid_amount).toFixed(2)}</td>
                  <td className="p-3.5 text-amber-400 font-bold">R$ {Number(r.remaining_amount).toFixed(2)}</td>
                  <td className="p-3.5">
                    <Badge
                      variant="outline"
                      className={
                        r.status === 'paid'
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                          : r.status === 'partial'
                          ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                          : 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                      }
                    >
                      {r.status === 'paid' ? 'Quitado' : r.status === 'partial' ? 'Parcial' : 'Pendente'}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-right">
                    {['pending', 'partial'].includes(r.status) && (
                      <Button onClick={() => handleOpenPayModal(r)} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> Dar Baixa
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Baixa de Conta a Receber */}
      {selectedReceivable && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Receber Pagamento de Cliente
            </h3>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="text-slate-400">Cliente: <span className="text-slate-100 font-semibold">{selectedReceivable.client?.name}</span></p>
              <p className="text-slate-400">Saldo Restante a Receber: <span className="text-amber-400 font-bold">R$ {Number(selectedReceivable.remaining_amount).toFixed(2)}</span></p>
            </div>

            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Valor do Recebimento (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedReceivable.remaining_amount)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-emerald-400 font-bold text-base"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Forma de Pagamento *</label>
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-slate-200"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setSelectedReceivable(null)} className="border-slate-800 text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4">
                  {isPending ? 'Confirmando...' : 'Confirmar Recebimento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
