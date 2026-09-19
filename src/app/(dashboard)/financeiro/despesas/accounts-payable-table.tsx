'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AccountPayable, PaymentMethod, FinancialCategory } from '@/types/database';
import { createAccountPayableAction, payAccountPayableAction } from '../actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, DollarSign, CheckCircle2 } from 'lucide-react';

interface AccountsPayableTableProps {
  payables: AccountPayable[];
  paymentMethods: PaymentMethod[];
  categories: FinancialCategory[];
}

export function AccountsPayableTable({ payables, paymentMethods, categories }: AccountsPayableTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [selectedPayable, setSelectedPayable] = useState<AccountPayable | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(paymentMethods[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await createAccountPayableAction({
        supplier_name: supplierName,
        category_id: categoryId || undefined,
        description,
        amount,
        due_date: dueDate,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setIsCreateModalOpen(false);
        setSupplierName('');
        setDescription('');
        setAmount(0);
        router.refresh();
      }
    });
  };

  const handleOpenPayModal = (p: AccountPayable) => {
    setSelectedPayable(p);
    setPayAmount(Number(p.remaining_amount));
    setErrorMsg(null);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;
    setErrorMsg(null);

    if (payAmount <= 0) {
      setErrorMsg('Informe um valor maior que 0.');
      return;
    }
    if (payAmount > Number(selectedPayable.remaining_amount)) {
      setErrorMsg(`O valor pago (R$ ${payAmount.toFixed(2)}) não pode exceder o saldo restante (R$ ${Number(selectedPayable.remaining_amount).toFixed(2)}).`);
      return;
    }

    startTransition(async () => {
      const res = await payAccountPayableAction(selectedPayable.id, payAmount, paymentMethodId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSelectedPayable(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-200">Lista de Despesas Cadastradas</h2>
        <Button onClick={() => setIsCreateModalOpen(true)} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs gap-1.5 shadow-md">
          <Plus className="w-3.5 h-3.5" /> Nova Despesa
        </Button>
      </div>

      {payables.length === 0 ? (
        <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 italic">
          Nenhuma conta a pagar cadastrada.
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="p-3.5">Descrição</th>
                <th className="p-3.5">Fornecedor</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Original</th>
                <th className="p-3.5">Pago</th>
                <th className="p-3.5">Restante</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {payables.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="p-3.5 font-semibold text-slate-100">{p.description}</td>
                  <td className="p-3.5 text-slate-400">{p.supplier_name || '-'}</td>
                  <td className="p-3.5 text-slate-400">{p.category?.name || '-'}</td>
                  <td className="p-3.5 text-slate-400">{new Date(p.due_date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3.5">R$ {Number(p.original_amount).toFixed(2)}</td>
                  <td className="p-3.5 text-emerald-400 font-semibold">R$ {Number(p.paid_amount).toFixed(2)}</td>
                  <td className="p-3.5 text-rose-400 font-bold">R$ {Number(p.remaining_amount).toFixed(2)}</td>
                  <td className="p-3.5">
                    <Badge
                      variant="outline"
                      className={
                        p.status === 'paid'
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                          : p.status === 'partial'
                          ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                          : 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                      }
                    >
                      {p.status === 'paid' ? 'Quitado' : p.status === 'partial' ? 'Parcial' : 'Pendente'}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-right">
                    {['pending', 'partial'].includes(p.status) && (
                      <Button onClick={() => handleOpenPayModal(p)} className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> Pagar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Criação de Despesa */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-base">Nova Despesa / Conta a Pagar</h3>
            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Descrição da Despesa *</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Aluguel do Salão ou Compra de Shampoos"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Fornecedor / Favorecido</label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Ex: Imobiliária ou Distribuidora"
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Selecione...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Valor Total (R$) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="bg-slate-950 border-slate-800 text-rose-400 font-bold text-base"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Data de Vencimento *</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="border-slate-800 text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4">
                  {isPending ? 'Salvando...' : 'Salvar Despesa'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Baixa de Conta a Pagar */}
      {selectedPayable && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-rose-400" /> Pagar Conta / Despesa
            </h3>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="text-slate-400">Despesa: <span className="text-slate-100 font-semibold">{selectedPayable.description}</span></p>
              <p className="text-slate-400">Saldo Restante a Pagar: <span className="text-rose-400 font-bold">R$ {Number(selectedPayable.remaining_amount).toFixed(2)}</span></p>
            </div>

            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Valor Pago (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedPayable.remaining_amount)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-rose-400 font-bold text-base"
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
                <Button type="button" variant="outline" onClick={() => setSelectedPayable(null)} className="border-slate-800 text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4">
                  {isPending ? 'Confirmando...' : 'Confirmar Pagamento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
