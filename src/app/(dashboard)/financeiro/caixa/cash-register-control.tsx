'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CashRegister, CashMovement } from '@/types/database';
import { openCashRegisterAction, closeCashRegisterAction, addCashMovementAction } from '../actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Landmark, ArrowUpRight, ArrowDownRight, CheckCircle2, Lock, Plus, AlertTriangle } from 'lucide-react';

interface CashRegisterControlProps {
  cashRegister: CashRegister | null;
  movements: CashMovement[];
}

export function CashRegisterControl({ cashRegister, movements }: CashRegisterControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados dos formulários
  const [openingBalance, setOpeningBalance] = useState<number>(100);
  const [movementType, setMovementType] = useState<'supply' | 'withdrawal'>('supply');
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementDesc, setMovementDesc] = useState<string>('');

  const [closingActualBalance, setClosingActualBalance] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Somatório das movimentações físicas do caixa aberto
  const salesCash = movements.filter((m) => ['sale', 'receipt'].includes(m.type)).reduce((a, b) => a + Number(b.amount), 0);
  const supplies = movements.filter((m) => m.type === 'supply').reduce((a, b) => a + Number(b.amount), 0);
  const withdrawals = movements.filter((m) => m.type === 'withdrawal').reduce((a, b) => a + Number(b.amount), 0);
  const expensesCash = movements.filter((m) => m.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);

  const openingBal = cashRegister ? Number(cashRegister.opening_balance) : 0;
  const expectedPhysicalDrawer = openingBal + salesCash + supplies - withdrawals - expensesCash;

  const handleOpenRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await openCashRegisterAction(openingBalance);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await addCashMovementAction(movementType, movementAmount, movementDesc);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setIsMovementModalOpen(false);
        setMovementAmount(0);
        setMovementDesc('');
        router.refresh();
      }
    });
  };

  const handleCloseRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashRegister) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await closeCashRegisterAction(cashRegister.id, closingActualBalance, closingNotes);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setIsCloseModalOpen(false);
        router.refresh();
      }
    });
  };

  if (!cashRegister) {
    return (
      <Card className="p-8 max-w-xl mx-auto bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 space-y-6 text-slate-100">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <Landmark className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">O caixa físico está FECHADO</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Abra o caixa diário informando o saldo inicial em espécie (troco de gaveta) para liberar recebimentos e saídas físicas.
          </p>
        </div>

        {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

        <form onSubmit={handleOpenRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Saldo Inicial de Abertura (Troco em R$) *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(Number(e.target.value))}
              className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-amber-400 font-bold text-lg text-center"
              required
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold py-3 shadow-lg shadow-amber-600/20">
            {isPending ? 'Abrindo Caixa...' : 'Abrir Caixa do Dia'}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo da Gaveta de Caixa */}
      <Card className="p-6 bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                Caixa Aberto
              </Badge>

              <span className="text-xs text-slate-500 dark:text-slate-400">Aberto às {new Date(cashRegister.opened_at).toLocaleTimeString('pt-BR')}</span>
            </div>

            <h2 className="text-2xl font-extrabold text-slate-100 mt-2">
              Saldo Esperado na Gaveta: <span className="text-amber-400">R$ {expectedPhysicalDrawer.toFixed(2)}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">Consolida apenas troco inicial + movimentações em espécie (dinheiro físico).</p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => setIsMovementModalOpen(true)} variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-200 hover:bg-slate-50 dark:bg-slate-800 text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Sangria / Suprimento
            </Button>
            <Button onClick={() => { setClosingActualBalance(expectedPhysicalDrawer); setIsCloseModalOpen(true); }} className="bg-rose-600 hover:bg-rose-500 text-slate-900 dark:text-white font-semibold text-xs gap-1.5 shadow-lg">
              <Lock className="w-3.5 h-3.5" /> Fechar Caixa Diário
            </Button>
          </div>
        </div>

        {/* Métrica da Gaveta */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-center text-xs">
          <div className="p-3 bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400">Saldo Inicial</p>
            <p className="font-bold text-slate-200 mt-0.5">R$ {openingBal.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400">Vendas (Espécie)</p>
            <p className="font-bold text-emerald-400 mt-0.5">+ R$ {salesCash.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400">Suprimentos</p>
            <p className="font-bold text-sky-400 mt-0.5">+ R$ {supplies.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400">Sangrias</p>
            <p className="font-bold text-rose-400 mt-0.5">- R$ {withdrawals.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl col-span-2 sm:col-span-1">
            <p className="text-slate-500 dark:text-slate-400">Despesas (Espécie)</p>
            <p className="font-bold text-rose-400 mt-0.5">- R$ {expensesCash.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      {/* Extrato de Movimentações da Gaveta (cash_movements) */}
      <Card className="p-6 bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-base font-semibold text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-3">Movimentações Físicas da Gaveta</h3>

        {movements.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">Nenhuma movimentação física até o momento neste caixa.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Hora</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 font-medium">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          ['sale', 'receipt', 'supply', 'opening'].includes(m.type)
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                            : 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                        }
                      >
                        {m.type === 'opening'
                          ? 'Abertura'
                          : m.type === 'supply'
                          ? 'Suprimento'
                          : m.type === 'withdrawal'
                          ? 'Sangria'
                          : m.type === 'expense'
                          ? 'Despesa Espécie'
                          : 'Recebimento Espécie'}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{m.description || '-'}</td>
                    <td className={`p-3 text-right font-bold ${['sale', 'receipt', 'supply', 'opening'].includes(m.type) ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {['sale', 'receipt', 'supply', 'opening'].includes(m.type) ? '+' : '-'} R$ {Number(m.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Sangria / Suprimento */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-base">Registrar Suprimento ou Sangria</h3>
            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

            <form onSubmit={handleAddMovement} className="space-y-4 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('supply')}
                  className={`flex-1 py-2 rounded-lg font-semibold border ${
                    movementType === 'supply' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  + Suprimento (Entrada Gaveta)
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('withdrawal')}
                  className={`flex-1 py-2 rounded-lg font-semibold border ${
                    movementType === 'withdrawal' ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  - Sangria (Retirada Gaveta)
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Valor (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={movementAmount || ''}
                  onChange={(e) => setMovementAmount(Number(e.target.value))}
                  className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-amber-400 font-bold text-base"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Descrição / Motivo *</label>
                <Input
                  value={movementDesc}
                  onChange={(e) => setMovementDesc(e.target.value)}
                  placeholder="Ex: Reforço de troco ou Depósito bancário"
                  className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-100 text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsMovementModalOpen(false)} className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold px-4">
                  {isPending ? 'Gravando...' : 'Confirmar Movimentação'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Fechamento de Caixa */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-400" /> Fechamento do Caixa Diário
            </h3>

            <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
              <p className="text-slate-500 dark:text-slate-400">Saldo Esperado na Gaveta:</p>
              <p className="text-lg font-bold text-amber-400">R$ {expectedPhysicalDrawer.toFixed(2)}</p>
            </div>

            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

            <form onSubmit={handleCloseRegister} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Valor Efetivamente Contado na Gaveta (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closingActualBalance}
                  onChange={(e) => setClosingActualBalance(Number(e.target.value))}
                  className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-100 font-bold text-base"
                  required
                />
              </div>

              {closingActualBalance !== expectedPhysicalDrawer && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  Divergência detectada: <span className="font-bold">R$ {(closingActualBalance - expectedPhysicalDrawer).toFixed(2)}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Justificativa / Observações</label>
                <Input
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Justifique qualquer divergência de troco..."
                  className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-100 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsCloseModalOpen(false)} className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-rose-600 hover:bg-rose-500 text-slate-900 dark:text-white font-semibold px-4">
                  {isPending ? 'Fechando...' : 'Confirmar Fechamento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
